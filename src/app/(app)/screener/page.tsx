import { requireUser } from "@/lib/auth";
import { getCustomWatchlist } from "@/lib/data";
import { getEurUsd, getSnapshots } from "@/lib/market/quotes";
import { WATCHLIST, type PeriodKey } from "@/lib/market/constants";
import { signalBadge } from "@/lib/market/indicators";
import { ScreenerTable, type ScreenerRow } from "./screener-table";
import { PeriodPicker } from "@/components/period-picker";
import { PageHeader } from "@/components/stat-card";

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

  const buys = rows.filter((r) => r.signal.toLowerCase().includes("achat")).length;
  const sells = rows.filter((r) => r.signal.toLowerCase().includes("vente")).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screener"
        description={`${rows.length} titres analysés · ${buys} signal(aux) d'achat, ${sells} de vente`}
        actions={<PeriodPicker current={period} />}
      />

      <ScreenerTable rows={rows} />
    </div>
  );
}
