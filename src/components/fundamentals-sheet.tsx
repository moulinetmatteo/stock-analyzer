import { SectionTitle } from "@/components/stat-card";
import { fmtNum, fmtCap, cn } from "@/lib/utils";
import type { Fundamentals } from "@/lib/market/quotes";

/**
 * Seuils indicatifs, pas des vérités : une marge de 8 % est excellente dans la
 * distribution et médiocre dans le logiciel. Ils servent à situer un ordre de
 * grandeur quand on débute, la comparaison au secteur reste à faire.
 */
type Verdict = "bon" | "moyen" | "faible" | null;

const TONE: Record<Exclude<Verdict, null>, string> = {
  bon: "text-[var(--gain)]",
  moyen: "text-foreground",
  faible: "text-[var(--loss)]",
};

/** `higher` : au-dessus c'est mieux. Sinon, plus bas c'est mieux. */
function judge(
  v: number | null,
  good: number,
  poor: number,
  higher = true,
): Verdict {
  if (v === null || Number.isNaN(v)) return null;
  if (higher) return v >= good ? "bon" : v <= poor ? "faible" : "moyen";
  return v <= good ? "bon" : v >= poor ? "faible" : "moyen";
}

function Metric({
  label,
  value,
  verdict,
  hint,
}: {
  label: string;
  value: string;
  verdict?: Verdict;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 font-medium",
          verdict ? TONE[verdict] : "text-foreground",
        )}
      >
        {value}
      </dd>
      {hint && <p className="text-muted-foreground/80 mt-0.5 text-[0.7rem]">{hint}</p>}
    </div>
  );
}

function Block({
  title,
  question,
  children,
}: {
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{question}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">{children}</dl>
    </div>
  );
}

const pct = (v: number | null, d = 1) =>
  v === null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(d)} %`;

const RECO: Record<string, string> = {
  strong_buy: "Achat fort",
  buy: "Achat",
  hold: "Conserver",
  underperform: "Sous-performance",
  sell: "Vente",
};

export function FundamentalsSheet({
  fund,
  eurusd,
  fx,
  priceEur,
}: {
  fund: Fundamentals;
  eurusd: number;
  /** Facteur de conversion vers l'euro, déjà calculé pour ce titre. */
  fx: number;
  priceEur: number;
}) {
  const target = fund.targetMean !== null ? fund.targetMean * fx : null;
  const upside = target !== null ? ((target - priceEur) / priceEur) * 100 : null;

  const cashNet =
    fund.totalCash !== null && fund.totalDebt !== null
      ? fund.totalCash - fund.totalDebt
      : null;

  return (
    <section className="surface-card p-5">
      <SectionTitle aside={fund.industry !== "—" ? fund.industry : fund.sector}>
        Fiche fondamentale
      </SectionTitle>

      <div className="space-y-4">
        <Block title="Rentabilité" question="Que garde l'entreprise sur ce qu'elle vend ?">
          <Metric
            label="Marge brute"
            value={pct(fund.grossMargin)}
            verdict={judge(fund.grossMargin, 0.4, 0.2)}
          />
          <Metric
            label="Marge opérationnelle"
            value={pct(fund.operatingMargin)}
            verdict={judge(fund.operatingMargin, 0.15, 0.05)}
          />
          <Metric
            label="Marge nette"
            value={pct(fund.netMargin)}
            verdict={judge(fund.netMargin, 0.1, 0.03)}
          />
          <Metric
            label="Rentabilité des capitaux"
            value={pct(fund.returnOnEquity)}
            verdict={judge(fund.returnOnEquity, 0.15, 0.05)}
            hint="ROE"
          />
        </Block>

        <Block title="Croissance" question="Progresse-t-elle, et à quel rythme ?">
          <Metric
            label="Chiffre d'affaires"
            value={pct(fund.revenueGrowth)}
            verdict={judge(fund.revenueGrowth, 0.1, 0)}
            hint="sur un an"
          />
          <Metric
            label="Bénéfices"
            value={pct(fund.earningsGrowth)}
            verdict={judge(fund.earningsGrowth, 0.1, 0)}
            hint="sur un an"
          />
          <Metric
            label="Free cash flow"
            value={fund.freeCashflow !== null ? fmtCap(fund.freeCashflow, eurusd) : "—"}
            verdict={fund.freeCashflow === null ? null : fund.freeCashflow > 0 ? "bon" : "faible"}
            hint="trésorerie réellement dégagée"
          />
          <Metric
            label="Capitalisation"
            value={fmtCap(fund.marketCap, eurusd)}
          />
        </Block>

        <Block title="Solidité" question="Résisterait-elle à un coup dur ?">
          <Metric
            label="Dette / capitaux propres"
            value={fund.debtToEquity !== null ? fmtNum(fund.debtToEquity, 0) : "—"}
            verdict={judge(fund.debtToEquity, 50, 150, false)}
            hint="en %, au-delà de 150 c'est lourd"
          />
          <Metric
            label="Liquidité générale"
            value={fund.currentRatio !== null ? fmtNum(fund.currentRatio, 2) : "—"}
            verdict={judge(fund.currentRatio, 1.5, 1)}
            hint="actifs courants / dettes courantes"
          />
          <Metric
            label="Trésorerie"
            value={fund.totalCash !== null ? fmtCap(fund.totalCash, eurusd) : "—"}
          />
          {/* Le libellé suit le signe : au-dessus de zéro c'est de la
              trésorerie qui reste, en dessous c'est de la dette qui subsiste. */}
          <Metric
            label={cashNet !== null && cashNet < 0 ? "Dette nette" : "Trésorerie nette"}
            value={cashNet !== null ? fmtCap(Math.abs(cashNet), eurusd) : "—"}
            verdict={cashNet === null ? null : cashNet > 0 ? "bon" : "moyen"}
            hint={
              cashNet === null
                ? undefined
                : cashNet < 0
                  ? "ce qui resterait dû après avoir tout remboursé"
                  : "ce qui resterait après avoir tout remboursé"
            }
          />
        </Block>

        <Block title="Valorisation" question="Le prix demandé est-il raisonnable ?">
          <Metric
            label="PER"
            value={fund.peRatio !== null ? fmtNum(fund.peRatio, 1) : "—"}
            verdict={judge(fund.peRatio, 20, 40, false)}
            hint="années de bénéfices pour rembourser le prix"
          />
          <Metric
            label="PER prévisionnel"
            value={fund.forwardPE !== null ? fmtNum(fund.forwardPE, 1) : "—"}
            verdict={judge(fund.forwardPE, 18, 35, false)}
            hint={
              fund.peRatio !== null && fund.forwardPE !== null
                ? fund.forwardPE < fund.peRatio
                  ? "bénéfices attendus en hausse"
                  : "bénéfices attendus en baisse"
                : undefined
            }
          />
          <Metric
            label="PEG"
            value={fund.pegRatio !== null ? fmtNum(fund.pegRatio, 2) : "—"}
            verdict={judge(fund.pegRatio, 1, 2, false)}
            hint="PER rapporté à la croissance"
          />
          <Metric
            label="Prix / chiffre d'affaires"
            value={fund.priceToSales !== null ? fmtNum(fund.priceToSales, 1) : "—"}
            verdict={judge(fund.priceToSales, 3, 10, false)}
          />
        </Block>

        {(fund.recommendation || fund.analystCount) && (
          <Block title="Consensus des analystes" question="Que pense le marché professionnel ?">
            <Metric
              label="Recommandation"
              value={fund.recommendation ? (RECO[fund.recommendation] ?? fund.recommendation) : "—"}
              verdict={
                fund.recommendation?.includes("buy")
                  ? "bon"
                  : fund.recommendation === "hold"
                    ? "moyen"
                    : fund.recommendation
                      ? "faible"
                      : null
              }
            />
            <Metric
              label="Analystes suivis"
              value={fund.analystCount !== null ? String(fund.analystCount) : "—"}
              hint={
                fund.analystCount !== null && fund.analystCount < 5
                  ? "peu suivi, consensus fragile"
                  : undefined
              }
            />
            <Metric
              label="Objectif moyen"
              value={target !== null ? `${fmtNum(target)} €` : "—"}
            />
            <Metric
              label="Potentiel implicite"
              value={upside !== null ? `${upside >= 0 ? "+" : ""}${fmtNum(upside, 1)} %` : "—"}
              verdict={upside === null ? null : upside > 10 ? "bon" : upside < 0 ? "faible" : "moyen"}
              hint="par rapport au cours actuel"
            />
          </Block>
        )}
      </div>

      <p className="text-muted-foreground mt-5 border-t pt-3 text-xs">
        Les couleurs situent un ordre de grandeur, elles ne jugent pas
        l&apos;entreprise : une marge de 8 % est excellente dans la distribution et
        médiocre dans le logiciel. La comparaison qui compte est celle avec les
        concurrents du même secteur.
      </p>
    </section>
  );
}
