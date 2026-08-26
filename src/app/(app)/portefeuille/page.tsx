import { requireUser } from "@/lib/auth";
import {
  getPortfolio, getTransactions, getJournal, getCustomWatchlist,
} from "@/lib/data";
import { getEurUsd, getSnapshots, getSeries } from "@/lib/market/quotes";
import { WATCHLIST } from "@/lib/market/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PositionsTab } from "./positions-tab";
import { TransactionsTab } from "./transactions-tab";
import { AnalyticsTab, type PortfolioPoint } from "./analytics-tab";
import { JournalTab } from "./journal-tab";

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

  const totalValue = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  const totalInvest = rows.reduce((a, r) => a + r.invest, 0);

  // ── Courbe de valorisation sur 1 an ─────────────────────────────────────────
  const timeline = new Map<string, number>();
  for (const p of portfolio) {
    const s = await getSeries(p.ticker, "1y");
    if (!s) continue;
    const fx = s.currency === "EUR" ? 1 : 1 / eurusd;
    for (const c of s.candles) {
      timeline.set(c.date, (timeline.get(c.date) ?? 0) + c.close * fx * p.quantite);
    }
  }
  const curve: PortfolioPoint[] = [...timeline.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));

  const benchmark = await getSeries("SPY", "1y");
  let spyPerf: number | null = null;
  if (benchmark && benchmark.candles.length > 1) {
    const first = benchmark.candles[0].close;
    const last = benchmark.candles.at(-1)!.close;
    spyPerf = (last / first - 1) * 100;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mon Portefeuille</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {portfolio.length} position{portfolio.length > 1 ? "s" : ""} ·{" "}
          {transactions.length} transaction{transactions.length > 1 ? "s" : ""}
        </p>
      </header>

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
