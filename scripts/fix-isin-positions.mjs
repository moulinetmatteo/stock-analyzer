/**
 * Remplace les codes ISIN par leur ticker Yahoo dans `portfolio` et
 * `transactions`, pour les positions importées avant que la conversion ne
 * fonctionne.
 *
 *   node scripts/fix-isin-positions.mjs <utilisateur>          # simulation
 *   node scripts/fix-isin-positions.mjs <utilisateur> --apply  # écriture
 *
 * Sans --apply, rien n'est modifié : le script se contente d'afficher ce qu'il
 * ferait.
 */
import { createClient } from "@supabase/supabase-js";
import YahooFinance from "yahoo-finance2";
import { readFileSync } from "fs";

const USER = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!USER) {
  console.error("Usage : node scripts/fix-isin-positions.mjs <utilisateur> [--apply]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const isIsin = (v) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(String(v).trim().toUpperCase());

async function resolves(symbol) {
  try {
    const q = await yf.quote(symbol);
    return q?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

async function isinToYahoo(isin) {
  const r = await yf.search(isin, { quotesCount: 6, newsCount: 0 }).catch(() => null);
  const syms = (r?.quotes ?? []).map((q) => q.symbol).filter(Boolean);
  const ordered = [
    ...syms.filter((s) => !s.startsWith(isin)),
    ...syms.filter((s) => s.startsWith(isin)),
  ];
  for (const c of ordered) {
    const price = await resolves(c);
    if (price) return { ticker: c, price };
  }
  return null;
}

const { data: positions } = await sb
  .from("portfolio").select("ticker,nom").eq("user_id", USER);

const targets = (positions ?? []).filter((p) => isIsin(p.ticker));
if (!targets.length) {
  console.log(`Aucun ISIN à convertir pour ${USER}.`);
  process.exit(0);
}

console.log(`${targets.length} position(s) à convertir pour ${USER}\n`);
const mapping = [];

for (const p of targets) {
  const hit = await isinToYahoo(p.ticker);
  if (!hit) {
    console.log(`  ${p.ticker}  ${p.nom}\n     → NON RÉSOLU, laissé tel quel`);
    continue;
  }
  mapping.push({ from: p.ticker, to: hit.ticker });
  console.log(`  ${p.ticker}  ${(p.nom ?? "").padEnd(24)} → ${hit.ticker}  (${hit.price.toFixed(2)})`);
}

if (!APPLY) {
  console.log(`\nSimulation — relance avec --apply pour écrire ces ${mapping.length} changement(s).`);
  process.exit(0);
}

let positionsUpdated = 0;
let transactionsUpdated = 0;

for (const m of mapping) {
  const { error: e1, count: c1 } = await sb
    .from("portfolio").update({ ticker: m.to }, { count: "exact" })
    .eq("user_id", USER).eq("ticker", m.from);
  if (e1) { console.error(`  ERREUR portfolio ${m.from} : ${e1.message}`); continue; }
  positionsUpdated += c1 ?? 0;

  const { error: e2, count: c2 } = await sb
    .from("transactions").update({ ticker: m.to }, { count: "exact" })
    .eq("user_id", USER).eq("ticker", m.from);
  if (e2) { console.error(`  ERREUR transactions ${m.from} : ${e2.message}`); continue; }
  transactionsUpdated += c2 ?? 0;
}

console.log(`\n${positionsUpdated} position(s) et ${transactionsUpdated} transaction(s) mises à jour.`);
