import { requireUser } from "@/lib/auth";
import { getCustomWatchlist } from "@/lib/data";
import { getEurUsd, getSeries, sliceToPeriod } from "@/lib/market/quotes";
import { WATCHLIST, type PeriodKey } from "@/lib/market/constants";
import { PeriodPicker } from "@/components/period-picker";
import { ComparisonView, type CompareSeries } from "./comparison-view";

export const dynamic = "force-dynamic";

export default async function ComparaisonPage({
  searchParams,
}: {
  searchParams: Promise<{ tickers?: string; periode?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = (sp.periode ?? "6mo") as PeriodKey;

  const custom = await getCustomWatchlist(user.username);
  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];

  const selected = (sp.tickers ?? "AAPL,MSFT,GOOGL")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);

  const eurusd = await getEurUsd();

  const series: CompareSeries[] = [];
  for (const ticker of selected) {
    const full = await getSeries(ticker, period);
    if (!full) continue;
    const s = sliceToPeriod(full, period);
    const fx = s.currency === "EUR" ? 1 : 1 / eurusd;
    const base = s.candles[0].close * fx;
    const nom = universe.find((u) => u.ticker === ticker)?.nom ?? ticker;
    const i = s.candles.length - 1;

    series.push({
      ticker,
      nom,
      points: s.candles.map((c, idx) => ({
        date: c.date,
        norm: ((c.close * fx) / base) * 100,
        rsi: s.rsi[idx],
      })),
      priceEur: s.candles[i].close * fx,
      perf: ((s.candles[i].close * fx) / base - 1) * 100,
      rsi: Number.isNaN(s.rsi[i]) ? null : s.rsi[i],
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comparaison</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Performance relative, base 100 à la date de départ.
          </p>
        </div>
        <PeriodPicker current={period} />
      </header>

      <ComparisonView universe={universe} selected={selected} series={series} />
    </div>
  );
}
