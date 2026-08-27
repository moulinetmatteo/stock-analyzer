/**
 * Historique réel d'un portefeuille, reconstruit depuis le registre des
 * transactions.
 *
 * L'approche naïve — quantité actuelle × cours passés — décrit ce que le
 * portefeuille d'aujourd'hui aurait valu hier, pas ce qu'il valait. Pour qui
 * investit progressivement, l'écart est majeur : détenir six parts depuis le
 * début n'a rien à voir avec les avoir accumulées mois après mois.
 */

export type Tx = {
  date: string;
  ticker: string;
  action: "achat" | "vente";
  quantite: number;
  prix: number;
};

export type PricesByTicker = Map<string, Map<string, number>>;

export type HistoryPoint = {
  date: string;
  /** Valorisation des titres détenus ce jour-là. */
  value: number;
  /** Somme nette versée depuis le début (achats moins ventes). */
  invested: number;
  /** Flux net du jour : positif à l'achat, négatif à la vente. */
  flow: number;
};

/**
 * Valorisation jour par jour, à partir des quantités réellement détenues.
 * L'historique démarre à la première transaction — avant, il n'y a rien à
 * valoriser.
 */
export function buildHistory(txs: Tx[], prices: PricesByTicker): HistoryPoint[] {
  if (!txs.length) return [];

  const ordered = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const start = ordered[0].date;

  // Union des dates cotées, à partir du premier achat.
  const dates = [
    ...new Set(
      [...prices.values()].flatMap((m) => [...m.keys()]).filter((d) => d >= start),
    ),
  ].sort();
  if (!dates.length) return [];

  // Flux et variations de quantité regroupés par date.
  const byDate = new Map<string, Tx[]>();
  for (const t of ordered) {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  }

  // Une transaction peut tomber un jour non coté (week-end, férié) : on
  // l'applique à la première séance suivante pour ne rien perdre.
  const pending = new Map<string, Tx[]>();
  for (const [d, list] of byDate) {
    const target = dates.find((x) => x >= d) ?? dates.at(-1)!;
    pending.set(target, [...(pending.get(target) ?? []), ...list]);
  }

  const held = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  let invested = 0;

  const out: HistoryPoint[] = [];

  for (const date of dates) {
    let flow = 0;
    for (const t of pending.get(date) ?? []) {
      const sign = t.action === "achat" ? 1 : -1;
      held.set(t.ticker, (held.get(t.ticker) ?? 0) + sign * t.quantite);
      const amount = t.quantite * t.prix;
      flow += sign * amount;
      invested += sign * amount;
    }

    // Cours de clôture connu le plus récent : un titre peut ne pas coter un
    // jour où d'autres le font (places et calendriers différents).
    let value = 0;
    for (const [ticker, qty] of held) {
      const p = prices.get(ticker)?.get(date);
      if (p !== undefined) lastPrice.set(ticker, p);
      const px = lastPrice.get(ticker);
      if (px !== undefined && qty > 0) value += qty * px;
    }

    out.push({ date, value, invested, flow });
  }

  return out;
}

/**
 * Rendement pondéré par le temps : on chaîne les variations quotidiennes en
 * neutralisant les versements. C'est la performance des titres eux-mêmes,
 * indépendante du moment où l'argent est entré — donc la seule comparable à un
 * indice.
 */
export function timeWeightedReturn(history: HistoryPoint[]): number | null {
  const usable = history.filter((h) => h.value > 0 || h.flow !== 0);
  if (usable.length < 2) return null;

  let factor = 1;
  let prevValue: number | null = null;

  for (const point of usable) {
    if (prevValue !== null && prevValue > 0) {
      // On retire le flux du jour : un versement n'est pas une performance.
      const gain = (point.value - point.flow) / prevValue;
      if (Number.isFinite(gain) && gain > 0) factor *= gain;
    }
    prevValue = point.value;
  }

  return (factor - 1) * 100;
}

/**
 * Taux de rendement interne annualisé : ce que l'argent a réellement rapporté,
 * en tenant compte de la date de chaque versement. Résolu par bissection —
 * robuste, et la précision d'un centième de point suffit largement ici.
 */
export function internalRateOfReturn(history: HistoryPoint[]): number | null {
  if (history.length < 2) return null;

  const flows = history.filter((h) => h.flow !== 0).map((h) => ({ date: h.date, amount: -h.flow }));
  const last = history.at(-1)!;
  if (!flows.length || last.value <= 0) return null;

  flows.push({ date: last.date, amount: last.value });

  const t0 = new Date(flows[0].date).getTime();
  const years = (d: string) => (new Date(d).getTime() - t0) / (365.25 * 86400_000);

  const npv = (rate: number) =>
    flows.reduce((sum, f) => sum + f.amount / (1 + rate) ** years(f.date), 0);

  // Un portefeuille peut perdre presque tout, ou beaucoup gagner : on cherche
  // large avant de resserrer.
  let lo = -0.99;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }

  return ((lo + hi) / 2) * 100;
}

/**
 * Rejoue les mêmes versements, aux mêmes dates, sur un indice de référence.
 * C'est la comparaison juste pour un investissement progressif : « et si
 * j'avais mis cet argent-là, ces jours-là, sur le S&P 500 ? » — et non deux
 * pourcentages calculés sur des flux différents.
 */
export function replayOnBenchmark(
  history: HistoryPoint[],
  benchmark: Map<string, number>,
): { value: number; invested: number } | null {
  const dates = [...benchmark.keys()].sort();
  if (!dates.length) return null;

  let units = 0;
  let invested = 0;
  let lastPrice: number | null = null;

  for (const point of history) {
    const p = benchmark.get(point.date);
    if (p !== undefined) lastPrice = p;
    if (point.flow === 0 || lastPrice === null || lastPrice <= 0) continue;
    units += point.flow / lastPrice;
    invested += point.flow;
  }

  if (lastPrice === null || invested <= 0) return null;
  return { value: units * lastPrice, invested };
}

export type PerfPoint = { date: string; index: number; ret: number };

/**
 * Indice de performance base 100 : la valeur d'un euro laissé dans le
 * portefeuille depuis le début.
 *
 * Volatilité, drawdown et Sharpe doivent se mesurer là-dessus, jamais sur la
 * valeur en euros : un versement fait bondir cette dernière sans qu'aucune
 * performance ait eu lieu. Sur un portefeuille alimenté mensuellement, le
 * premier versement peut représenter une « hausse » de 60 % en un jour, ce qui
 * fausse tout ce qui en découle.
 */
export function performanceIndex(history: HistoryPoint[]): PerfPoint[] {
  const out: PerfPoint[] = [];
  let index = 100;
  let prevValue: number | null = null;

  for (const point of history) {
    let ret = 0;
    if (prevValue !== null && prevValue > 0) {
      const gain = (point.value - point.flow) / prevValue;
      if (Number.isFinite(gain) && gain > 0) {
        ret = gain - 1;
        index *= gain;
      }
    }
    if (point.value > 0 || prevValue !== null) out.push({ date: point.date, index, ret });
    prevValue = point.value;
  }

  return out;
}

/** Volatilité annualisée, en pourcentage, à partir des rendements quotidiens. */
export function annualisedVolatility(perf: PerfPoint[]): number | null {
  const rets = perf.slice(1).map((p) => p.ret);
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** Drawdown, en pourcentage, mesuré sur l'indice et non sur les euros. */
export function drawdownSeries(perf: PerfPoint[]): { date: string; dd: number }[] {
  let peak = perf[0]?.index ?? 100;
  return perf.map((p) => {
    peak = Math.max(peak, p.index);
    return { date: p.date, dd: peak > 0 ? ((p.index - peak) / peak) * 100 : 0 };
  });
}
