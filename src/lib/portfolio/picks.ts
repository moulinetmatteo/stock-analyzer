/**
 * Sépare ce qui relève d'une sélection de titre de ce qui relève d'un placement
 * passif, pour pouvoir répondre à la seule question qui compte quand on
 * commence à picker : est-ce que ça bat le fait d'acheter l'indice ?
 */

/** Familles de fonds : Yahoo classe certains produits en EQUITY à tort. */
const FUND_MARKERS = [
  "ishares", "amundi", "lyxor", "xtrackers", "vanguard", "spdr",
  "invesco", "wisdomtree", "bnp paribas easy", "ucits", "etf", "etc",
  "physical gold", "physical silver", "index fund", "tracker",
];

export type AssetKind = "fonds" | "action";

/**
 * `quoteType` fait foi quand il dit ETF ou MUTUALFUND. Pour le reste on
 * inspecte le nom : un ETC sur l'or arrive en EQUITY chez Yahoo alors qu'il
 * n'a rien d'une sélection de titre.
 */
export function classify(quoteType: string | null, name: string): AssetKind {
  const t = (quoteType ?? "").toUpperCase();
  if (t === "ETF" || t === "MUTUALFUND" || t === "INDEX") return "fonds";

  const n = name.toLowerCase();
  if (FUND_MARKERS.some((m) => n.includes(m))) return "fonds";

  return "action";
}

export type PickResult = {
  ticker: string;
  nom: string;
  /** Somme nette engagée sur cette ligne. */
  invested: number;
  /** Valorisation actuelle. */
  value: number;
  /** Ce que les mêmes versements auraient donné sur l'indice de référence. */
  benchmarkValue: number | null;
};

/** Écart cumulé entre les picks et l'indice, en euros. */
export function summarise(picks: PickResult[]) {
  const invested = picks.reduce((a, p) => a + p.invested, 0);
  const value = picks.reduce((a, p) => a + p.value, 0);
  const benchmark = picks.every((p) => p.benchmarkValue !== null)
    ? picks.reduce((a, p) => a + (p.benchmarkValue ?? 0), 0)
    : null;

  return {
    invested,
    value,
    benchmark,
    edge: benchmark !== null ? value - benchmark : null,
    // Pourcentage de picks ayant fait mieux que l'indice : plus parlant qu'une
    // moyenne, qu'une seule ligne très gagnante suffirait à maquiller.
    winners: picks.filter((p) => p.benchmarkValue !== null && p.value > p.benchmarkValue).length,
    total: picks.length,
  };
}
