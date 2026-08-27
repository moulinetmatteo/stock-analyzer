import { requireUser } from "@/lib/auth";
import { getCandidates, getCustomWatchlist, getPortfolio } from "@/lib/data";
import { getEurUsd, getSnapshots } from "@/lib/market/quotes";
import { WATCHLIST } from "@/lib/market/constants";
import { PageHeader } from "@/components/stat-card";
import { CandidatesView, type CandidateRow } from "./candidates-view";

export const dynamic = "force-dynamic";

export default async function CandidatsPage() {
  const user = await requireUser();
  const [candidates, custom, portfolio, eurusd] = await Promise.all([
    getCandidates(user.username),
    getCustomWatchlist(user.username),
    getPortfolio(user.username),
    getEurUsd(),
  ]);

  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];

  const snaps = await getSnapshots(candidates.map((c) => c.ticker), "3mo", eurusd);
  const held = new Set(portfolio.map((p) => p.ticker));

  const rows: CandidateRow[] = candidates.map((c) => {
    const snap = snaps.get(c.ticker);
    const price = snap?.priceEur ?? null;
    return {
      ...c,
      price,
      rsi: snap?.rsi ?? null,
      // Ce qu'aurait donné l'intuition : l'écart depuis la mise sous surveillance.
      sinceAdded:
        price !== null && c.prix_ajout
          ? ((price - c.prix_ajout) / c.prix_ajout) * 100
          : null,
      // Distance au prix auquel on a dit vouloir acheter.
      toTarget:
        price !== null && c.prix_cible
          ? ((price - c.prix_cible) / c.prix_cible) * 100
          : null,
      held: held.has(c.ticker),
    };
  });

  const watching = rows.filter((r) => r.statut === "surveille").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidats"
        description={
          rows.length
            ? `${watching} sous surveillance · ${rows.length - watching} archivé(s)`
            : "Les titres que tu surveilles, avec la raison qui t'a fait les remarquer"
        }
      />
      <CandidatesView rows={rows} universe={universe} />
    </div>
  );
}
