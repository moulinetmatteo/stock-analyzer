import { requireUser } from "@/lib/auth";
import { getAlerts, getCustomWatchlist } from "@/lib/data";
import { getEurUsd, getSnapshots } from "@/lib/market/quotes";
import { WATCHLIST } from "@/lib/market/constants";
import { AlertsView, type AlertRow } from "./alerts-view";
import { PageHeader } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function AlertesPage() {
  const user = await requireUser();
  const eurusd = await getEurUsd();

  const [alerts, custom] = await Promise.all([
    getAlerts(user.username),
    getCustomWatchlist(user.username),
  ]);

  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];

  const snaps = await getSnapshots(
    [...new Set([...alerts.map((a) => a.ticker), ...universe.map((u) => u.ticker)])],
    "1mo",
    eurusd,
  );

  const rows: AlertRow[] = alerts.map((a) => {
    const price = snaps.get(a.ticker)?.priceEur ?? null;
    let status: AlertRow["status"] = "veille";
    if (price !== null) {
      if (a.seuil_bas && price <= a.seuil_bas) status = "achat";
      else if (a.seuil_haut && price >= a.seuil_haut) status = "vente";
    }
    return { ...a, price, status };
  });

  const prices = Object.fromEntries(
    [...snaps.entries()].map(([t, s]) => [t, s.priceEur]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertes prix"
        description="Définis des seuils par titre. Ils remontent sur le dashboard et, si Telegram est configuré, déclenchent une notification."
      />

      <AlertsView rows={rows} universe={universe} prices={prices} />
    </div>
  );
}
