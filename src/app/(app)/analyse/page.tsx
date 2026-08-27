import { requireUser } from "@/lib/auth";
import { getCustomWatchlist } from "@/lib/data";
import {
  getEurUsd, getSeries, sliceToPeriod, getFundamentals, getNews,
} from "@/lib/market/quotes";
import { WATCHLIST, type PeriodKey } from "@/lib/market/constants";
import { signalBadge } from "@/lib/market/indicators";
import { toChartPoints } from "@/lib/market/to-chart";
import { SignalBadge, RsiPill } from "@/components/signal-badge";
import { StatCard, PageHeader, SectionTitle } from "@/components/stat-card";
import { PeriodPicker } from "@/components/period-picker";
import { TickerPicker } from "@/components/ticker-picker";
import { AnalysisCharts } from "./analysis-charts";
import { fmtEur, fmtPct, fmtCap, fmtNum } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; periode?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = (sp.periode ?? "3mo") as PeriodKey;

  const custom = await getCustomWatchlist(user.username);
  const universe = [
    ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
    ...custom,
  ];

  const ticker = sp.ticker ?? universe[0].ticker;
  const label = universe.find((u) => u.ticker === ticker)?.nom ?? ticker;

  const [eurusd, full] = await Promise.all([getEurUsd(), getSeries(ticker, period)]);

  if (!full) {
    return (
      <div className="space-y-6">
        <TickerPicker universe={universe} current={ticker} />
        <p className="text-sm text-muted-foreground">
          Données indisponibles pour <span className="font-mono">{ticker}</span>.
        </p>
      </div>
    );
  }

  const s = sliceToPeriod(full, period);
  const fx = s.currency === "EUR" ? 1 : 1 / eurusd;
  const points = toChartPoints(s, fx);

  const i = s.candles.length - 1;
  const priceEur = s.candles[i].close * fx;
  const prevEur = s.candles[i - 1].close * fx;
  const change = ((priceEur - prevEur) / prevEur) * 100;

  const num = (v: number) => (Number.isNaN(v) ? null : v);
  const rsiV = num(s.rsi[i]);
  const stochV = num(s.stochK[i]);
  const ema50 = num(s.ema50[i]);
  const ema200 = num(s.ema200[i]);

  const sig = signalBadge({
    rsi: rsiV, macd: num(s.macd[i]), macdSignal: num(s.macdSignal[i]),
    stochK: stochV, close: s.candles[i].close,
    bbLow: num(s.bbLower[i]), bbUp: num(s.bbUpper[i]),
  });

  const [fund, news] = await Promise.all([getFundamentals(ticker), getNews(ticker)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={label}
        description={`${ticker} · coté en ${s.currency}`}
        actions={
          <>
            <TickerPicker universe={universe} current={ticker} />
            <PeriodPicker current={period} />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Prix"
          value={fmtEur(priceEur)}
          delta={fmtPct(change)}
          deltaTone={change > 0 ? "gain" : change < 0 ? "loss" : "muted"}
        />
        <div className="surface-card p-4">
          <p className="label-eyebrow">RSI (14)</p>
          <p className="metric mt-2">
            <RsiPill value={rsiV} />
          </p>
        </div>
        <StatCard
          label="Stoch %K"
          value={stochV !== null ? stochV.toFixed(1) : "—"}
        />
        <StatCard
          label="EMA 50 / 200"
          value={
            ema50 !== null && ema200 !== null
              ? ema50 > ema200
                ? "Golden"
                : "Death"
              : "—"
          }
          hint={ema50 !== null && ema200 !== null ? "croisement long terme" : undefined}
        />
        <div className="surface-card flex flex-col p-4">
          <p className="label-eyebrow">Signal global</p>
          <div className="mt-auto pt-3">
            <SignalBadge label={sig.label} className="text-sm px-2.5 py-1" />
          </div>
        </div>
      </div>

      <AnalysisCharts points={points} />

      {fund && (
        <section className="surface-card p-5">
          <SectionTitle aside={`Secteur : ${fund.sector}`}>Données fondamentales</SectionTitle>
          <div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              <Fund label="Capitalisation" value={fmtCap(fund.marketCap, eurusd)} />
              <Fund label="P/E ratio" value={fund.peRatio ? fmtNum(fund.peRatio, 1) : "—"} />
              <Fund
                label="Dividende"
                value={fund.dividendYield ? `${fund.dividendYield.toFixed(2)}%` : "—"}
              />
              <Fund label="Beta" value={fund.beta ? fmtNum(fund.beta, 2) : "—"} />
              <Fund
                label="52s haut"
                value={fund.fiftyTwoWeekHigh ? fmtEur(fund.fiftyTwoWeekHigh * fx) : "—"}
              />
              <Fund
                label="52s bas"
                value={fund.fiftyTwoWeekLow ? fmtEur(fund.fiftyTwoWeekLow * fx) : "—"}
              />
            </dl>
            <p className="text-muted-foreground mt-4 text-xs">
              Devise d&apos;origine : {fund.currency} · convertie au taux du jour
            </p>
          </div>
        </section>
      )}

      <section className="surface-card p-5">
        <SectionTitle>Comment lire ces indicateurs</SectionTitle>
        <div className="text-muted-foreground space-y-2 text-sm">
          <p>
            <strong className="text-foreground">RSI</strong> — sous 30 le titre est
            survendu (achat potentiel), au-dessus de 70 suracheté.
          </p>
          <p>
            <strong className="text-foreground">Stochastique</strong> — sous 20 achat,
            au-dessus de 80 vente ; le croisement %K/%D signale un retournement.
          </p>
          <p>
            <strong className="text-foreground">Bollinger</strong> — prix sur la bande
            basse = achat, bande haute = vente ; des bandes resserrées annoncent une
            forte variation.
          </p>
          <p>
            <strong className="text-foreground">Golden / Death Cross</strong> — EMA 50
            au-dessus de l&apos;EMA 200 marque une tendance haussière de fond.
          </p>
          <p>
            <strong className="text-foreground">MACD</strong> — croisement à la hausse =
            achat, à la baisse = vente.
          </p>
          <p className="border-t pt-3">
            Trois indicateurs alignés donnent un signal fort. Ces outils restent une aide
            à la décision : n&apos;investis jamais plus que ce que tu peux perdre.
          </p>
        </div>
      </section>

      {news.length > 0 && (
        <section className="surface-card p-5">
          <SectionTitle aside={`${news.length} article(s)`}>Actualités récentes</SectionTitle>
          <div>
            <ul className="divide-y">
              {news.slice(0, 6).map((n, idx) => (
                <li key={idx} className="py-3 first:pt-0 last:pb-0">
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium group-hover:underline">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.publisher}
                        {n.publishedAt &&
                          ` · ${new Date(n.publishedAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                          })}`}
                      </p>
                    </div>
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function Fund({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular font-medium">{value}</dd>
    </div>
  );
}
