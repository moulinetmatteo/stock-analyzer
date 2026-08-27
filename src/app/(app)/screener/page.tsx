import { requireUser } from "@/lib/auth";
import { getCustomWatchlist } from "@/lib/data";
import { getEurUsd, getSnapshots, getFundamentalsBatch } from "@/lib/market/quotes";
import { WATCHLIST, type PeriodKey } from "@/lib/market/constants";
import { signalBadge } from "@/lib/market/indicators";
import { ScreenerTable, type ScreenerRow } from "./screener-table";
import { FundamentalTable, type FundamentalRow } from "./fundamental-table";
import { ViewSwitch } from "./view-switch";
import { PeriodPicker } from "@/components/period-picker";
import { PageHeader } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; vue?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = (sp.periode ?? "3mo") as PeriodKey;
  const vue = sp.vue === "fondamental" ? "fondamental" : "technique";

  const custom = await getCustomWatchlist(user.username);
  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];

  // Une seule des deux vues est chargée : les fondamentaux et les cours ont des
  // coûts très différents, il n'y a pas de raison de payer les deux.
  if (vue === "fondamental") {
    const funds = await getFundamentalsBatch(universe.map((u) => u.ticker));

    const rows: FundamentalRow[] = universe.flatMap((u) => {
      const f = funds.get(u.ticker);
      if (!f) return [];
      return [{
        nom: u.nom,
        ticker: u.ticker,
        secteur: f.industry !== "—" ? f.industry : f.sector,
        marketCap: f.marketCap,
        netMargin: f.netMargin,
        returnOnEquity: f.returnOnEquity,
        revenueGrowth: f.revenueGrowth,
        earningsGrowth: f.earningsGrowth,
        debtToEquity: f.debtToEquity,
        peRatio: f.peRatio,
        forwardPE: f.forwardPE,
        pegRatio: f.pegRatio,
        recommendation: f.recommendation,
      }];
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Screener"
          description={`${rows.length} entreprises · rentabilité, croissance, solidité et prix`}
          actions={<ViewSwitch current={vue} />}
        />
        <FundamentalTable rows={rows} />
      </div>
    );
  }

  const eurusd = await getEurUsd();
  const snaps = await getSnapshots(universe.map((u) => u.ticker), period, eurusd);

  const rows: ScreenerRow[] = universe.flatMap((u) => {
    const s = snaps.get(u.ticker);
    if (!s) return [];
    const sig = signalBadge({
      rsi: s.rsi, macd: s.macd, macdSignal: s.macdSignal,
      stochK: s.stochK, close: s.close, bbLow: s.bbLow, bbUp: s.bbUp,
    });
    const cross =
      s.ema50 !== null && s.ema200 !== null
        ? s.ema50 > s.ema200 ? "Golden" : "Death"
        : "—";
    return [{
      nom: u.nom, ticker: u.ticker, price: s.priceEur, change: s.changePct,
      rsi: s.rsi, stochK: s.stochK, cross, signal: sig.label,
    }];
  });

  const buys = rows.filter((r) => r.signal.toLowerCase().includes("achat")).length;
  const sells = rows.filter((r) => r.signal.toLowerCase().includes("vente")).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screener"
        description={`${rows.length} titres · ${buys} signal(aux) d'achat, ${sells} de vente`}
        actions={
          <>
            <ViewSwitch current={vue} />
            <PeriodPicker current={period} />
          </>
        }
      />
      <ScreenerTable rows={rows} />
    </div>
  );
}
