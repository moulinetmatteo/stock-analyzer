/** Contrôle de la classification fonds / action. */
import { classify, summarise } from "../src/lib/portfolio/picks.ts";

const cases = [
  ["ETF", "iShares Core S&P 500 UCITS ETF", "fonds", "ETF déclaré"],
  ["EQUITY", "ISHARES PHYSICAL METALS PLC", "fonds", "ETC sur l'or, mal classé par Yahoo"],
  ["EQUITY", "Meta Platforms, Inc.", "action", "vraie action"],
  ["EQUITY", "LVMH", "action", "action française"],
  ["ETF", "Amundi CAC 40 UCITS ETF Acc", "fonds", "ETF français"],
  ["EQUITY", "BNP Paribas Easy S&P 500 UCITS", "fonds", "fonds classé EQUITY"],
  [null, "Vanguard Total World Stock", "fonds", "type inconnu, nom explicite"],
  ["EQUITY", "Apple Inc.", "action", "aucun marqueur de fonds"],
];

const results = cases.map(([t, n, expected, why]) => {
  const got = classify(t, n);
  return { ok: got === expected, n, got, expected, why };
});

const s = summarise([
  { ticker: "A", nom: "A", invested: 100, value: 130, benchmarkValue: 120 },
  { ticker: "B", nom: "B", invested: 100, value: 90, benchmarkValue: 120 },
]);
results.push({
  ok: s.edge === -20 && s.winners === 1 && s.total === 2,
  n: "agrégat", got: `écart ${s.edge} €, ${s.winners}/${s.total} gagnants`,
  expected: "écart -20 €, 1/2", why: "un gagnant, un perdant",
});

console.log(`\n${"─".repeat(70)}`);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${String(r.n).slice(0,34).padEnd(36)} ${r.got.padEnd(8)} ${r.why}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log("─".repeat(70));
console.log(`${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
