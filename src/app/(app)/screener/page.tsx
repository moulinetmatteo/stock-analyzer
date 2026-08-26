import { requireUser } from "@/lib/auth";
import { getCustomWatchlist } from "@/lib/data";
import { getEurUsd, getSnapshots } from "@/lib/market/quotes";
import { WATCHLIST, type PeriodKey } from "@/lib/market/constants";
import { signalBadge } from "@/lib/market/indicators";
import { ScreenerTable, type ScreenerRow } from "./screener-table";
import { PeriodPicker } from "@/components/period-picker";

export const dynamic = "force-dynamic";

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = (sp.periode ?? "3mo") as PeriodKey;

  const [custom, eurusd] = await Promise.all([
    getCustomWatchlist(user.username),
    getEurUsd(),
  ]);

  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];
  const snaps = await getSnapshots(
    universe.map((u) => u.ticker),
    period,
    eurusd,
  );

  const rows: ScreenerRow[] = universe.flatMap((u) => {
    const s = snaps.get(u.ticker);
    if (!s) return [];
    const sig = signalBadge({
      rsi: s.rsi, macd: s.macd, macdSignal: s.macdSignal,
      stochK: s.stochK, close: s.close, bbLow: s.bbLow, bbUp: s.bbUp,
    });
    const cross =
      s.ema50 !== null && s.ema200 !== null
        ? s.ema50 > s.ema200
          ? "Golden"
          : "Death"
        : "—";
    return [{
      nom: u.nom,
      ticker: u.ticker,
      price: s.priceEur,
      change: s.changePct,
      rsi: s.rsi,
      stochK: s.stochK,
      cross,
      signal: sig.label,
    }];
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} titres · RSI &lt; 30 signale une survente, &gt; 70 un surachat.
          </p>
        </div>
        <PeriodPicker current={period} />
      </header>

      <ScreenerTable rows={rows} />
    </div>
  );
}
