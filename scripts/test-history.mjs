/**
 * Contrôle des calculs d'historique sur des cas dont la réponse se pose à la
 * main. Ces chiffres alimentent la volatilité, le Sharpe et le drawdown : une
 * erreur ici serait invisible et plausible.
 *
 *   node --experimental-strip-types scripts/test-history.mjs
 */
import {
  buildHistory, timeWeightedReturn, internalRateOfReturn, replayOnBenchmark,
  performanceIndex, annualisedVolatility, drawdownSeries,
} from "../src/lib/portfolio/history.ts";

const results = [];
const near = (a, b, tol = 0.05) => a !== null && Math.abs(a - b) <= tol;
const check = (n, ok, d = "") => results.push({ n, ok, d });

// ── 1. Accumulation progressive ─────────────────────────────────────────────
// Une part à 100 le jour 1, une seconde à 110 le jour 3, cours 121 le jour 4.
{
  const prices = new Map([["X", new Map([
    ["2026-01-01", 100], ["2026-01-02", 110], ["2026-01-03", 110], ["2026-01-04", 121],
  ])]]);
  const txs = [
    { date: "2026-01-01", ticker: "X", action: "achat", quantite: 1, prix: 100 },
    { date: "2026-01-03", ticker: "X", action: "achat", quantite: 1, prix: 110 },
  ];
  const h = buildHistory(txs, prices);

  check("valorisation au 1er jour", h[0].value === 100, `${h[0].value}`);
  check("hausse avant le 2e achat", h[1].value === 110, `${h[1].value} (1 part à 110)`);
  check("2 parts après le 2e achat", h[2].value === 220, `${h[2].value}`);
  check("valorisation finale", h[3].value === 242, `${h[3].value}`);
  check("total versé", h[3].invested === 210, `${h[3].invested} €`);

  // La méthode naïve aurait affiché 2 parts dès le départ, soit 200 au jour 1.
  check("pas de rétro-projection", h[0].value !== 200, `jour 1 = ${h[0].value}, pas 200`);

  // TWR : +10 % puis 0 % (le versement n'est pas une performance) puis +10 %.
  const twr = timeWeightedReturn(h);
  check("rendement pondéré temps", near(twr, 21), `${twr?.toFixed(2)} % (attendu 21)`);

  // Rendement simple : 242 pour 210 versés, soit +15,2 % — question différente.
  const simple = (242 / 210 - 1) * 100;
  check("écart avec le rendement simple", Math.abs(twr - simple) > 5,
    `TWR ${twr.toFixed(1)} % contre ${simple.toFixed(1)} % en simple`);
}

// ── 2. TRI sur un an ────────────────────────────────────────────────────────
// 1000 € placés, 1100 € un an plus tard : 10 % annuel.
{
  const prices = new Map([["Y", new Map([["2025-01-01", 100], ["2026-01-01", 110]])]]);
  const txs = [{ date: "2025-01-01", ticker: "Y", action: "achat", quantite: 10, prix: 100 }];
  const h = buildHistory(txs, prices);
  const irr = internalRateOfReturn(h);
  check("TRI sur un placement unique", near(irr, 10, 0.3), `${irr?.toFixed(2)} % (attendu 10)`);
}

// ── 3. Versements mensuels ──────────────────────────────────────────────────
// 100 € par mois pendant 12 mois sur un titre stable : le TRI doit être nul.
{
  const dates = Array.from({ length: 13 }, (_, i) =>
    `2025-${String(i + 1).padStart(2, "0")}-01`.replace("2025-13", "2026-01"));
  const prices = new Map([["Z", new Map(dates.map((d) => [d, 100]))]]);
  const txs = dates.slice(0, 12).map((d) => ({
    date: d, ticker: "Z", action: "achat", quantite: 1, prix: 100,
  }));
  const h = buildHistory(txs, prices);
  check("12 versements cumulés", h.at(-1).invested === 1200, `${h.at(-1).invested} €`);
  check("valorisation = versements si cours plat", h.at(-1).value === 1200, `${h.at(-1).value} €`);
  const irr = internalRateOfReturn(h);
  check("TRI nul sur cours plat", near(irr, 0, 0.5), `${irr?.toFixed(2)} %`);
}

// ── 4. Vente partielle ──────────────────────────────────────────────────────
{
  const prices = new Map([["W", new Map([
    ["2026-01-01", 100], ["2026-01-02", 100], ["2026-01-03", 100],
  ])]]);
  const txs = [
    { date: "2026-01-01", ticker: "W", action: "achat", quantite: 10, prix: 100 },
    { date: "2026-01-03", ticker: "W", action: "vente", quantite: 4, prix: 100 },
  ];
  const h = buildHistory(txs, prices);
  check("quantité réduite après vente", h[2].value === 600, `${h[2].value} € (6 parts)`);
  check("versement net diminué", h[2].invested === 600, `${h[2].invested} €`);
}

// ── 5. Transaction un jour non coté ─────────────────────────────────────────
// Achat un samedi : il doit être pris en compte à la séance suivante.
{
  const prices = new Map([["V", new Map([
    ["2026-01-02", 100], ["2026-01-05", 100],
  ])]]);
  const txs = [{ date: "2026-01-03", ticker: "V", action: "achat", quantite: 5, prix: 100 }];
  const h = buildHistory(txs, prices);
  const monday = h.find((p) => p.date === "2026-01-05");
  check("achat week-end reporté au lundi", monday?.value === 500, `${monday?.value} €`);
}

// ── 6. Comparaison à l'indice, mêmes versements ─────────────────────────────
// Deux versements de 100 €, indice à 100 puis 200 : 1,5 part, soit 300 €.
{
  const prices = new Map([["A", new Map([["2026-01-01", 50], ["2026-06-01", 50]])]]);
  const txs = [
    { date: "2026-01-01", ticker: "A", action: "achat", quantite: 2, prix: 50 },
    { date: "2026-06-01", ticker: "A", action: "achat", quantite: 2, prix: 50 },
  ];
  const h = buildHistory(txs, prices);
  const bench = new Map([["2026-01-01", 100], ["2026-06-01", 200]]);
  const r = replayOnBenchmark(h, bench);
  check("versements rejoués sur l'indice", near(r?.value, 300, 0.01),
    `${r?.value.toFixed(2)} € pour ${r?.invested} € versés (attendu 300)`);
}

// ── 7. Les versements ne créent ni volatilité ni drawdown ───────────────────
// Cours parfaitement plat, versement chaque mois : les deux doivent être nuls.
{
  const dates = Array.from({ length: 60 }, (_, i) =>
    new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10));
  const prices = new Map([["S", new Map(dates.map((d) => [d, 100]))]]);
  const txs = dates.filter((_, i) => i % 20 === 0).map((d) => ({
    date: d, ticker: "S", action: "achat", quantite: 1, prix: 100,
  }));
  const h = buildHistory(txs, prices);
  const perf = performanceIndex(h);
  const vol = annualisedVolatility(perf);
  const dd = Math.min(...drawdownSeries(perf).map((x) => x.dd));

  check("versements sans volatilité", near(vol, 0, 0.01), `${vol?.toFixed(3)} %`);
  check("versements sans drawdown", near(dd, 0, 0.01), `${dd.toFixed(3)} %`);

  // Le calcul naïf, sur les euros, verrait d'énormes variations.
  const naive = [];
  for (let i = 1; i < h.length; i++) if (h[i-1].value > 0) naive.push(h[i].value / h[i-1].value - 1);
  const worst = Math.max(...naive.map(Math.abs)) * 100;
  check("le calcul naïf se serait trompé", worst > 20,
    `il aurait vu ${worst.toFixed(0)} % de variation sur un cours plat`);
}

// ── 8. Volatilité réelle préservée ──────────────────────────────────────────
// Cours qui alterne ±1 % par jour, sans versement : la volatilité doit sortir.
{
  const dates = Array.from({ length: 100 }, (_, i) =>
    new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10));
  let px = 100;
  const series = dates.map((d, i) => { if (i) px *= i % 2 ? 1.01 : 1 / 1.01; return [d, px]; });
  const prices = new Map([["T", new Map(series)]]);
  const txs = [{ date: dates[0], ticker: "T", action: "achat", quantite: 10, prix: 100 }];
  const perf = performanceIndex(buildHistory(txs, prices));
  const vol = annualisedVolatility(perf);
  check("volatilité réelle détectée", vol !== null && vol > 10 && vol < 20,
    `${vol?.toFixed(1)} % (≈ 1 %/jour annualisé ≈ 16 %)`);
}

console.log(`\n${"─".repeat(66)}`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.n.padEnd(34)} ${r.d}`);
const failed = results.filter((r) => !r.ok).length;
console.log("─".repeat(66));
console.log(`${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
