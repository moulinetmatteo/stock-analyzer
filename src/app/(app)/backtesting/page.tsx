import { requireUser } from "@/lib/auth";
import { getCustomWatchlist } from "@/lib/data";
import { getEurUsd, getSeries, sliceToPeriod } from "@/lib/market/quotes";
import { WATCHLIST, type PeriodKey } from "@/lib/market/constants";
import { runBacktest, type Strategy } from "@/lib/market/backtest";
import { BacktestForm } from "./backtest-form";
import { BacktestResults } from "./backtest-results";

export const dynamic = "force-dynamic";

const ALLOWED: Strategy[] = ["rsi", "macd", "rsi_macd"];

export default async function BacktestingPage({
  searchParams,
}: {
  searchParams: Promise<{
    ticker?: string; periode?: string; strategie?: string;
    rsiBuy?: string; rsiSell?: string; capital?: string; run?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const custom = await getCustomWatchlist(user.username);
  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];

  const ticker = sp.ticker ?? "AAPL";
  const period = (sp.periode ?? "1y") as PeriodKey;
  const strategy = (ALLOWED.includes(sp.strategie as Strategy)
    ? sp.strategie
    : "rsi_macd") as Strategy;
  const rsiBuy = Math.min(Math.max(Number(sp.rsiBuy ?? 30), 10), 40);
  const rsiSell = Math.min(Math.max(Number(sp.rsiSell ?? 70), 60), 90);
  const capital = Math.max(Number(sp.capital ?? 1000), 100);
  const shouldRun = sp.run === "1";

  const params = { ticker, period, strategy, rsiBuy, rsiSell, capital };
  const label = universe.find((u) => u.ticker === ticker)?.nom ?? ticker;

  let result = null;
  if (shouldRun) {
    const [eurusd, full] = await Promise.all([getEurUsd(), getSeries(ticker, period)]);
    if (full) {
      const s = sliceToPeriod(full, period);
      const fx = s.currency === "EUR" ? 1 : 1 / eurusd;
      result = runBacktest({
        dates: s.candles.map((c) => c.date),
        close: s.candles.map((c) => c.close * fx),
        rsi: s.rsi,
        macd: s.macd,
        macdSignal: s.macdSignal,
        strategy, rsiBuy, rsiSell, capital,
      });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Backtesting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rejoue une stratégie sur l&apos;historique et compare-la au simple
          buy-and-hold. Aucun frais de courtage n&apos;est modélisé.
        </p>
      </header>

      <BacktestForm universe={universe} params={params} />

      {shouldRun && !result && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Données indisponibles pour {ticker}.
        </p>
      )}

      {result && <BacktestResults result={result} label={label} capital={capital} />}
    </div>
  );
}
