export type CurvePoint = { date: string; value: number };

export type CurveInput = {
  quantite: number;
  /** Cours en euros, indexés par date ISO (YYYY-MM-DD). */
  prices: Map<string, number>;
};

/**
 * Valorisation quotidienne d'un portefeuille multi-places.
 *
 * Les places n'ont pas le même calendrier : sommer naïvement les lignes cotées
 * un jour donné fait chuter le total les jours fériés d'une seule bourse, ce qui
 * crée de faux décrochages et fausse volatilité, Sharpe et drawdown. On reporte
 * donc le dernier cours connu de chaque ligne, et la courbe ne démarre qu'une
 * fois toutes les lignes cotées au moins une fois.
 */
export function buildPortfolioCurve(positions: CurveInput[]): CurvePoint[] {
  const held = positions.filter((p) => p.prices.size > 0);
  if (!held.length) return [];

  const allDates = [...new Set(held.flatMap((p) => [...p.prices.keys()]))].sort();

  // Première date où chaque ligne dispose d'un cours.
  const start = held
    .map((p) => [...p.prices.keys()].sort()[0])
    .reduce((a, b) => (a > b ? a : b));

  const lastSeen = new Array<number | undefined>(held.length).fill(undefined);
  const out: CurvePoint[] = [];

  for (const date of allDates) {
    held.forEach((p, i) => {
      const price = p.prices.get(date);
      if (price !== undefined) lastSeen[i] = price;
    });

    if (date < start) continue;
    if (lastSeen.some((v) => v === undefined)) continue;

    let total = 0;
    held.forEach((p, i) => { total += lastSeen[i]! * p.quantite; });
    out.push({ date, value: total });
  }

  return out;
}
