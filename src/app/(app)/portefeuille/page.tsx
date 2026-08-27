import { requireUser } from "@/lib/auth";
import {
  getPortfolio, getTransactions, getJournal, getCustomWatchlist,
} from "@/lib/data";
import { getEurUsd, getSnapshots, getSeries, getQuoteTypes } from "@/lib/market/quotes";
import {
  buildHistory, timeWeightedReturn, internalRateOfReturn, replayOnBenchmark,
  performanceIndex, annualisedVolatility, drawdownSeries,
  type Tx,
} from "@/lib/portfolio/history";
import { WATCHLIST } from "@/lib/market/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PositionsTab } from "./positions-tab";
import { TransactionsTab } from "./transactions-tab";
import { AnalyticsTab, type PortfolioPoint } from "./analytics-tab";
import { JournalTab } from "./journal-tab";
import { PicksTab, type PickLine } from "./picks-tab";
import { classify } from "@/lib/portfolio/picks";
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

  // ── Historique réel, reconstruit depuis les transactions ────────────────────
  // Les cours sont chargés sur deux ans : l'historique doit remonter au premier
  // achat, pas seulement à l'année écoulée.
  const tickersHistoriques = [...new Set(transactions.map((t) => t.ticker))];
  const priceMaps = new Map<string, Map<string, number>>();
  await Promise.all(
    tickersHistoriques.map(async (ticker) => {
      const s = await getSeries(ticker, "2y");
      if (!s) return;
      const fx = s.currency === "EUR" ? 1 : 1 / eurusd;
      priceMaps.set(ticker, new Map(s.candles.map((c) => [c.date, c.close * fx])));
    }),
  );

  const ledger: Tx[] = transactions.map((t) => ({
    date: t.date,
    ticker: t.ticker,
    action: t.action,
    quantite: t.quantite,
    prix: t.prix,
  }));

  const history = buildHistory(ledger, priceMaps);
  const curve: PortfolioPoint[] = history.map((h) => ({
    date: h.date,
    value: h.value,
    invested: h.invested,
  }));

  const twr = timeWeightedReturn(history);
  const irr = internalRateOfReturn(history);

  // Volatilité, drawdown et Sharpe se mesurent sur l'indice de performance :
  // sur la valeur en euros, chaque versement passerait pour un rendement.
  const perf = performanceIndex(history);
  const volatility = annualisedVolatility(perf);
  const drawdown = drawdownSeries(perf);
  const maxDrawdown = drawdown.length ? Math.min(...drawdown.map((d) => d.dd)) : null;

  const years = Math.max(perf.length / 252, 0.08);
  const annualisedTwr = twr !== null ? ((1 + twr / 100) ** (1 / years) - 1) * 100 : null;
  const sharpe =
    volatility && volatility > 0 && annualisedTwr !== null
      ? (annualisedTwr - 3) / volatility
      : null;

  // Mêmes versements, mêmes dates, sur le S&P 500 : la seule comparaison juste
  // quand l'argent entre progressivement.
  const spy = await getSeries("SPY", "2y");
  let benchmark: { value: number; invested: number } | null = null;
  if (spy) {
    const fx = spy.currency === "EUR" ? 1 : 1 / eurusd;
    benchmark = replayOnBenchmark(
      history,
      new Map(spy.candles.map((c) => [c.date, c.close * fx])),
    );
  }

  // ── Sélection en direct contre indice ───────────────────────────────────────
  const kinds = await getQuoteTypes(tickersHistoriques);
  const isPick = (ticker: string) => {
    const k = kinds.get(ticker);
    return classify(k?.quoteType ?? null, k?.name ?? ticker) === "action";
  };

  const spyPrices = spy
    ? new Map(
        spy.candles.map((c) => [
          c.date,
          c.close * (spy.currency === "EUR" ? 1 : 1 / eurusd),
        ]),
      )
    : null;

  const picks: PickLine[] = [];
  let fundsInvested = 0;
  let fundsValue = 0;

  for (const p of portfolio) {
    const priced = rows.find((r) => r.ticker === p.ticker);
    const value = priced?.value ?? 0;

    // Chaque ligne est reconstruite depuis ses propres transactions : le PRU
    // moyen ne suffit pas pour rejouer les versements aux bonnes dates.
    const lineTxs = ledger.filter((t) => t.ticker === p.ticker);
    const lineHistory = buildHistory(
      lineTxs,
      new Map([[p.ticker, priceMaps.get(p.ticker) ?? new Map()]]),
    );
    const invested = lineHistory.at(-1)?.invested ?? p.quantite * p.prix_achat;

    if (!isPick(p.ticker)) {
      fundsInvested += invested;
      fundsValue += value;
      continue;
    }

    const replayed = spyPrices ? replayOnBenchmark(lineHistory, spyPrices) : null;
    picks.push({
      ticker: p.ticker,
      nom: priced?.nom ?? p.nom,
      invested,
      value,
      benchmarkValue: replayed?.value ?? null,
    });
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
          <TabsTrigger value="picks">Mes picks</TabsTrigger>
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
            twr={twr}
            irr={irr}
            benchmark={benchmark}
            volatility={volatility}
            sharpe={sharpe}
            maxDrawdown={maxDrawdown}
            drawdown={drawdown}
            allocation={rows
              .filter((r) => r.value !== null)
              .map((r) => ({ nom: r.nom, value: r.value! }))}
          />
        </TabsContent>

        <TabsContent value="picks" className="pt-5">
          <PicksTab
            picks={picks}
            funds={{ invested: fundsInvested, value: fundsValue }}
            benchmarkName="le S&P 500"
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
