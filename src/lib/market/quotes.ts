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
  currency: string;
  longName: string;
};

export async function getFundamentals(ticker: string): Promise<Fundamentals | null> {
  try {
    const [q, summary] = await Promise.all([
      yahooFinance.quote(ticker),
      yahooFinance
        .quoteSummary(ticker, { modules: ["summaryProfile", "defaultKeyStatistics"] })
        .catch(() => null),
    ]);
    if (!q) return null;
    return {
      marketCap: q.marketCap ?? null,
      peRatio: q.trailingPE ?? null,
      dividendYield: q.dividendYield ?? null,
      beta: summary?.defaultKeyStatistics?.beta ?? null,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
      sector: summary?.summaryProfile?.sector ?? "—",
      currency: q.currency ?? "",
      longName: q.longName ?? q.shortName ?? ticker,
    };
  } catch {
    return null;
  }
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

export async function isinToYahoo(isin: string): Promise<string> {
  if (!isin || isin.length !== 12 || !/^[A-Za-z]{2}/.test(isin)) return isin;
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin }]),
    });
    const json = await res.json();
    const items = json?.[0]?.data ?? [];
    if (!items.length) return isin;

    const us = items.find((it: { exchCode?: string }) =>
      ["US", "UN", "UW", "UA", "UP"].includes(it.exchCode ?? ""),
    );
    if (us) return us.ticker;

    const eu = items.find((it: { exchCode?: string }) => EXCH_SUFFIX[it.exchCode ?? ""]);
    if (eu) return eu.ticker + EXCH_SUFFIX[eu.exchCode];

    return items[0].ticker ?? isin;
  } catch {
    return isin;
  }
}
