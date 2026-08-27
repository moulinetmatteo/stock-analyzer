import "server-only";
import YahooFinance from "yahoo-finance2";
import { TICKER_CURRENCY, PERIODS, type PeriodKey } from "./constants";
import { rsi, macd, bollinger, stochastic, ema } from "./indicators";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type EnrichedSeries = {
  ticker: string;
  currency: "USD" | "EUR";
  candles: Candle[];
  rsi: number[];
  macd: number[];
  macdSignal: number[];
  macdHist: number[];
  ema20: number[];
  ema50: number[];
  ema200: number[];
  bbUpper: number[];
  bbLower: number[];
  bbMid: number[];
  stochK: number[];
  stochD: number[];
};

/**
 * On télécharge toujours au moins 1 an pour que les EMA 200 et le RSI aient
 * assez d'historique, puis on tronque à la période demandée à l'affichage.
 */
function downloadWindow(period: PeriodKey): number {
  return Math.max(PERIODS[period].days, 400);
}

const memo = new Map<string, { at: number; data: EnrichedSeries | null }>();
const TTL_MS = 5 * 60 * 1000;

export async function getSeries(
  ticker: string,
  period: PeriodKey = "3mo",
): Promise<EnrichedSeries | null> {
  const key = `${ticker}:${period}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  try {
    const days = downloadWindow(period);
    const start = new Date();
    start.setDate(start.getDate() - days);

    const rows = await yahooFinance.chart(ticker, {
      period1: start,
      interval: "1d",
    });

    const quotes = (rows.quotes ?? []).filter(
      (q) => q.close !== null && q.close !== undefined,
    );
    if (quotes.length < 2) {
      memo.set(key, { at: Date.now(), data: null });
      return null;
    }

    const candles: Candle[] = quotes.map((q) => ({
      date: new Date(q.date).toISOString().slice(0, 10),
      open: q.open ?? q.close!,
      high: q.high ?? q.close!,
      low: q.low ?? q.close!,
      close: q.close!,
      volume: q.volume ?? 0,
    }));

    const close = candles.map((c) => c.close);
    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);

    const m = macd(close);
    const bb = bollinger(close);
    const st = stochastic(high, low, close);

    const data: EnrichedSeries = {
      ticker,
      currency: TICKER_CURRENCY[ticker] ?? (rows.meta?.currency === "EUR" ? "EUR" : "USD"),
      candles,
      rsi: rsi(close),
      macd: m.macd,
      macdSignal: m.signal,
      macdHist: m.hist,
      ema20: ema(close, 20),
      ema50: ema(close, 50),
      ema200: ema(close, 200),
      bbUpper: bb.upper,
      bbLower: bb.lower,
      bbMid: bb.mid,
      stochK: st.k,
      stochD: st.d,
    };

    memo.set(key, { at: Date.now(), data });
    return data;
  } catch {
    memo.set(key, { at: Date.now(), data: null });
    return null;
  }
}

/** Tronque une série enrichie à la fenêtre visible demandée. */
export function sliceToPeriod(s: EnrichedSeries, period: PeriodKey): EnrichedSeries {
  const days = PERIODS[period].days;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const from = s.candles.findIndex((c) => c.date >= cutoffStr);
  if (from <= 0) return s;

  const cut = <T,>(arr: T[]) => arr.slice(from);
  return {
    ...s,
    candles: cut(s.candles),
    rsi: cut(s.rsi),
    macd: cut(s.macd),
    macdSignal: cut(s.macdSignal),
    macdHist: cut(s.macdHist),
    ema20: cut(s.ema20),
    ema50: cut(s.ema50),
    ema200: cut(s.ema200),
    bbUpper: cut(s.bbUpper),
    bbLower: cut(s.bbLower),
    bbMid: cut(s.bbMid),
    stochK: cut(s.stochK),
    stochD: cut(s.stochD),
  };
}

let fxCache: { at: number; rate: number } | null = null;

/** Taux EUR/USD (1 € = X $), avec repli à 1.08 si Yahoo est injoignable. */
export async function getEurUsd(): Promise<number> {
  if (fxCache && Date.now() - fxCache.at < 60 * 60 * 1000) return fxCache.rate;
  try {
    const q = await yahooFinance.quote("EURUSD=X");
    const rate = q?.regularMarketPrice ?? 1.08;
    fxCache = { at: Date.now(), rate };
    return rate;
  } catch {
    return fxCache?.rate ?? 1.08;
  }
}

export function toEur(price: number, currency: "USD" | "EUR", eurusd: number): number {
  return currency === "EUR" ? price : price / eurusd;
}

export type Fundamentals = {
  marketCap: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  sector: string;
  industry: string;
  currency: string;
  longName: string;

  // Rentabilité — ce que l'entreprise garde de ce qu'elle vend.
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  returnOnEquity: number | null;

  // Croissance, sur les douze derniers mois.
  revenueGrowth: number | null;
  earningsGrowth: number | null;

  // Solidité du bilan.
  debtToEquity: number | null;
  currentRatio: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  freeCashflow: number | null;

  // Valorisation.
  forwardPE: number | null;
  pegRatio: number | null;
  priceToSales: number | null;
  priceToBook: number | null;

  // Consensus des analystes.
  recommendation: string | null;
  analystCount: number | null;
  targetMean: number | null;
};

// Les fondamentaux changent au rythme des publications trimestrielles : les
// garder six heures évite de réinterroger Yahoo à chaque visite.
const fundMemo = new Map<string, { at: number; data: Fundamentals | null }>();
const FUND_TTL_MS = 6 * 60 * 60 * 1000;

export async function getFundamentals(ticker: string): Promise<Fundamentals | null> {
  const hit = fundMemo.get(ticker);
  if (hit && Date.now() - hit.at < FUND_TTL_MS) return hit.data;

  try {
    const [q, summary] = await Promise.all([
      yahooFinance.quote(ticker),
      yahooFinance
        .quoteSummary(ticker, {
          modules: [
            "summaryProfile", "defaultKeyStatistics", "financialData", "summaryDetail",
          ],
        })
        .catch(() => null),
    ]);
    if (!q) return null;

    const prof = summary?.summaryProfile;
    const ks = summary?.defaultKeyStatistics;
    const fd = summary?.financialData;
    const sd = summary?.summaryDetail;
    const n = (v: number | undefined | null) => (v === undefined ? null : v);

    const result: Fundamentals = {
      marketCap: q.marketCap ?? null,
      peRatio: q.trailingPE ?? n(sd?.trailingPE),
      dividendYield: q.dividendYield ?? null,
      beta: n(ks?.beta) ?? n(sd?.beta),
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
      sector: prof?.sector ?? "—",
      industry: prof?.industry ?? "—",
      currency: q.currency ?? "",
      longName: q.longName ?? q.shortName ?? ticker,

      grossMargin: n(fd?.grossMargins),
      operatingMargin: n(fd?.operatingMargins),
      netMargin: n(fd?.profitMargins),
      returnOnEquity: n(fd?.returnOnEquity),

      revenueGrowth: n(fd?.revenueGrowth),
      earningsGrowth: n(fd?.earningsGrowth),

      debtToEquity: n(fd?.debtToEquity),
      currentRatio: n(fd?.currentRatio),
      totalCash: n(fd?.totalCash),
      totalDebt: n(fd?.totalDebt),
      freeCashflow: n(fd?.freeCashflow),

      forwardPE: n(sd?.forwardPE) ?? n(ks?.forwardPE),
      pegRatio: n(ks?.pegRatio),
      priceToSales: n(sd?.priceToSalesTrailing12Months),
      priceToBook: n(ks?.priceToBook),

      recommendation: fd?.recommendationKey ?? null,
      analystCount: n(fd?.numberOfAnalystOpinions),
      targetMean: n(fd?.targetMeanPrice),
    };

    fundMemo.set(ticker, { at: Date.now(), data: result });
    return result;
  } catch {
    fundMemo.set(ticker, { at: Date.now(), data: null });
    return null;
  }
}

/** Fondamentaux en lot, avec la même limite de concurrence que les cours. */
export async function getFundamentalsBatch(
  tickers: string[],
  concurrency = 8,
): Promise<Map<string, Fundamentals>> {
  const out = new Map<string, Fundamentals>();
  const queue = [...tickers];

  async function worker() {
    for (;;) {
      const t = queue.shift();
      if (!t) return;
      const f = await getFundamentals(t);
      // Un ETF n'a ni marge ni rentabilité des capitaux : il n'a rien à faire
      // dans un tableau fondamental.
      if (f && f.netMargin !== null) out.set(t, f);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tickers.length) }, worker));
  return out;
}

export type NewsItem = {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
};

export async function getNews(ticker: string): Promise<NewsItem[]> {
  try {
    const res = await yahooFinance.search(ticker, { newsCount: 8, quotesCount: 0 });
    return (res.news ?? []).map((n) => ({
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      publishedAt: n.providerPublishTime
        ? new Date(n.providerPublishTime).toISOString()
        : "",
    }));
  } catch {
    return [];
  }
}

/** Prochaine date de publication des résultats, format YYYY-MM-DD. */
export async function getEarningsDate(ticker: string): Promise<string | null> {
  try {
    const r = await yahooFinance.quoteSummary(ticker, { modules: ["calendarEvents"] });
    const d = r?.calendarEvents?.earnings?.earningsDate?.[0];
    return d ? new Date(d).toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

/** Snapshot léger pour les listes : dernier prix en €, variation veille, RSI. */
export type Snapshot = {
  ticker: string;
  priceEur: number;
  changePct: number;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  stochK: number | null;
  close: number;
  bbLow: number | null;
  bbUp: number | null;
  ema50: number | null;
  ema200: number | null;
};

export async function getSnapshot(
  ticker: string,
  period: PeriodKey,
  eurusd: number,
): Promise<Snapshot | null> {
  const s = await getSeries(ticker, period);
  if (!s || s.candles.length < 2) return null;
  const i = s.candles.length - 1;
  const last = s.candles[i].close;
  const prev = s.candles[i - 1].close;
  const priceEur = toEur(last, s.currency, eurusd);
  const prevEur = toEur(prev, s.currency, eurusd);
  const num = (v: number) => (Number.isNaN(v) ? null : v);
  return {
    ticker,
    priceEur,
    changePct: ((priceEur - prevEur) / prevEur) * 100,
    rsi: num(s.rsi[i]),
    macd: num(s.macd[i]),
    macdSignal: num(s.macdSignal[i]),
    stochK: num(s.stochK[i]),
    close: last,
    bbLow: num(s.bbLower[i]),
    bbUp: num(s.bbUpper[i]),
    ema50: num(s.ema50[i]),
    ema200: num(s.ema200[i]),
  };
}

/** Snapshots en parallèle, avec limite de concurrence pour ménager Yahoo. */
export async function getSnapshots(
  tickers: string[],
  period: PeriodKey,
  eurusd: number,
  concurrency = 8,
): Promise<Map<string, Snapshot>> {
  const out = new Map<string, Snapshot>();
  const queue = [...tickers];

  async function worker() {
    for (;;) {
      const t = queue.shift();
      if (!t) return;
      const snap = await getSnapshot(t, period, eurusd);
      if (snap) out.set(t, snap);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tickers.length) }, worker),
  );
  return out;
}

/** Résolution ISIN → ticker Yahoo via OpenFIGI (Bloomberg). */
const EXCH_SUFFIX: Record<string, string> = {
  LN: ".L", FP: ".PA", GY: ".DE", NA: ".AS", SM: ".MC", SW: ".SW",
  IM: ".MI", DC: ".CO", SS: ".ST", HO: ".HE", BB: ".BR", AV: ".VI",
  PW: ".WA", PL: ".LS", IR: ".IR",
};

/** Le symbole existe-t-il vraiment côté Yahoo ? */
async function tickerResolves(symbol: string): Promise<boolean> {
  try {
    const q = await yahooFinance.quote(symbol);
    return !!q?.regularMarketPrice;
  } catch {
    return false;
  }
}

/**
 * ISIN → ticker Yahoo.
 *
 * On interroge d'abord la recherche Yahoo, qui indexe les ISIN et renvoie donc
 * des symboles que Yahoo sait forcément coter. OpenFIGI ne sert que de repli :
 * il renvoie des tickers Bloomberg qui n'ont pas toujours d'équivalent Yahoo.
 * Chaque candidat est vérifié avant d'être retenu.
 */
export async function isinToYahoo(isin: string): Promise<string> {
  const code = isin?.trim().toUpperCase();
  if (!code || code.length !== 12 || !/^[A-Z]{2}/.test(code)) return isin;

  const candidates: string[] = [];

  // 1. Recherche Yahoo — les symboles qui reprennent l'ISIN (cotations
  //    secondaires type .SG) passent en dernier, ils sont peu liquides.
  try {
    const res = await yahooFinance.search(code, { quotesCount: 6, newsCount: 0 });
    const symbols = (res.quotes ?? [])
      .map((q) => ("symbol" in q ? q.symbol : undefined))
      .filter((s): s is string => !!s);
    candidates.push(
      ...symbols.filter((s) => !s.startsWith(code)),
      ...symbols.filter((s) => s.startsWith(code)),
    );
  } catch { /* on tente OpenFIGI */ }

  // 2. Repli OpenFIGI
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: code }]),
    });
    const items = (await res.json())?.[0]?.data ?? [];
    for (const it of items as { ticker?: string; exchCode?: string }[]) {
      if (!it.ticker) continue;
      if (["US", "UN", "UW", "UA", "UP"].includes(it.exchCode ?? "")) {
        candidates.push(it.ticker);
      }
      const sfx = EXCH_SUFFIX[it.exchCode ?? ""];
      if (sfx) candidates.push(it.ticker + sfx);
    }
  } catch { /* on retombera sur l'ISIN */ }

  for (const c of [...new Set(candidates)]) {
    if (await tickerResolves(c)) return c;
  }
  return isin;
}

export type QuoteKind = { quoteType: string | null; name: string };

/**
 * Nature et intitulé d'un titre, pour distinguer un fonds d'une action choisie.
 * Mis en cache avec les fondamentaux : ces informations ne changent jamais.
 */
export async function getQuoteTypes(
  tickers: string[],
  concurrency = 8,
): Promise<Map<string, QuoteKind>> {
  const out = new Map<string, QuoteKind>();
  const queue = [...tickers];

  async function worker() {
    for (;;) {
      const t = queue.shift();
      if (!t) return;
      try {
        const q = await yahooFinance.quote(t);
        out.set(t, {
          quoteType: q?.quoteType ?? null,
          name: q?.longName ?? q?.shortName ?? t,
        });
      } catch {
        out.set(t, { quoteType: null, name: t });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tickers.length) }, worker));
  return out;
}
