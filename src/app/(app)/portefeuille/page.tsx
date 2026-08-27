import { requireUser } from "@/lib/auth";
import {
  getPortfolio, getTransactions, getJournal, getCustomWatchlist,
} from "@/lib/data";
import { getEurUsd, getSnapshots, getSeries } from "@/lib/market/quotes";
import { buildPortfolioCurve } from "@/lib/market/portfolio-curve";
import { WATCHLIST } from "@/lib/market/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PositionsTab } from "./positions-tab";
import { TransactionsTab } from "./transactions-tab";
import { AnalyticsTab, type PortfolioPoint } from "./analytics-tab";
import { JournalTab } from "./journal-tab";
import { PageHeader } from "@/components/stat-card";

export const dynamic = "force-dynamic";

export default async function PortefeuillePage() {
  const user = await requireUser();
  const eurusd = await getEurUsd();

  const [portfolio, transactions, journal, custom] = await Promise.all([
    getPortfolio(user.username),
    getTransactions(user.username),
    getJournal(user.username),
    getCustomWatchlist(user.username),
  ]);

  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];

  const snaps = await getSnapshots(
    portfolio.map((p) => p.ticker),
    "1mo",
    eurusd,
  );

  const rows = portfolio.map((p) => {
    const s = snaps.get(p.ticker);
    const current = s?.priceEur ?? null;
    const invest = p.quantite * p.prix_achat;
    const value = current !== null ? p.quantite * current : null;
    return {
      ...p,
      current,
      invest,
      value,
      pnl: value !== null ? value - invest : null,
      pnlPct: value !== null ? ((current! - p.prix_achat) / p.prix_achat) * 100 : null,
    };
  });

  // Les lignes sans cours (ticker introuvable chez Yahoo) sont exclues des deux
  // totaux : les compter côté investi seulement afficherait un faux -100 %.
  const priced = rows.filter((r) => r.value !== null);
  const totalValue = priced.reduce((a, r) => a + r.value!, 0);
  const totalInvest = priced.reduce((a, r) => a + r.invest, 0);
  const unpriced = rows.filter((r) => r.value === null).map((r) => r.ticker);

  // ── Courbe de valorisation sur 1 an ─────────────────────────────────────────
  const histories = await Promise.all(
    portfolio.map(async (p) => {
      const s = await getSeries(p.ticker, "1y");
      if (!s) return null;
      const fx = s.currency === "EUR" ? 1 : 1 / eurusd;
      return {
        quantite: p.quantite,
        prices: new Map(s.candles.map((c) => [c.date, c.close * fx])),
      };
    }),
  );
  const curve: PortfolioPoint[] = buildPortfolioCurve(
    histories.filter((h): h is NonNullable<typeof h> => h !== null),
  );

  const benchmark = await getSeries("SPY", "1y");
  let spyPerf: number | null = null;
  if (benchmark && benchmark.candles.length > 1) {
    const first = benchmark.candles[0].close;
    const last = benchmark.candles.at(-1)!.close;
    spyPerf = (last / first - 1) * 100;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon portefeuille"
        description={`${portfolio.length} position${portfolio.length > 1 ? "s" : ""} · ${transactions.length} transaction${transactions.length > 1 ? "s" : ""}`}
      />

      <Tabs defaultValue="positions">
        <TabsList>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analyse</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="pt-5">
          <PositionsTab
            rows={rows}
            totalValue={totalValue}
            totalInvest={totalInvest}
            unpriced={unpriced}
            universe={universe}
          />
        </TabsContent>

        <TabsContent value="transactions" className="pt-5">
          <TransactionsTab transactions={transactions} universe={universe} />
        </TabsContent>

        <TabsContent value="analytics" className="pt-5">
          <AnalyticsTab
            curve={curve}
            invested={totalInvest}
            allocation={rows
              .filter((r) => r.value !== null)
              .map((r) => ({ nom: r.nom, value: r.value! }))}
            spyPerf={spyPerf}
          />
        </TabsContent>

        <TabsContent value="journal" className="pt-5">
          <JournalTab
            positions={rows.map((r) => ({
              ticker: r.ticker,
              nom: r.nom,
              current: r.current,
            }))}
            entries={journal}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
