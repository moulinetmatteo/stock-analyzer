/**
 * Vérifie le cache des analyses IA sans dépenser d'appel au modèle : on insère
 * une analyse factice en base, puis on contrôle que la route la ressert, qu'elle
 * la considère périmée au-delà du délai, et que « Rafraîchir » la contourne.
 *
 *   node scripts/test-ai-cache.mjs
 *
 * Prérequis : le serveur de dev tourne, et sql/ai-analyses.sql a été exécuté
 * dans Supabase.
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { readFileSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const USER = process.argv[2] ?? "demo";
const TICKER = "ZZTEST";
const PERIOD = "3mo";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const exp = Date.now() + 86400_000;
const pl = `${USER}.${exp}`;
const cookie = `sa_session=${pl}.${createHmac("sha256", env.SESSION_SECRET).update(pl).digest("base64url")}`;

const results = [];
const check = (n, ok, d = "") => results.push({ n, ok, d });

const MARKER = "ANALYSE FACTICE DE TEST — ne pas lire.";

async function call(force) {
  const res = await fetch(`${BASE}/api/analyse-ia`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ ticker: TICKER, periode: PERIOD, force }),
  });
  return {
    status: res.status,
    cache: res.headers.get("X-Cache"),
    generatedAt: res.headers.get("X-Generated-At"),
    price: res.headers.get("X-Generated-Price"),
    body: await res.text(),
  };
}

async function seed(ageMs) {
  await sb.from("ai_analyses").upsert(
    {
      user_id: USER,
      ticker: TICKER,
      periode: PERIOD,
      content: MARKER,
      price_eur: 123.45,
      created_at: new Date(Date.now() - ageMs).toISOString(),
    },
    { onConflict: "user_id,ticker,periode" },
  );
}

try {
  const probe = await sb.from("ai_analyses").select("id").limit(1);
  if (probe.error) {
    console.error(`Table absente : ${probe.error.message}`);
    console.error("Exécute sql/ai-analyses.sql dans Supabase → SQL Editor.");
    process.exit(1);
  }

  // 1. Analyse récente : servie depuis le cache.
  await seed(30 * 60 * 1000); // 30 minutes
  const fresh = await call(false);
  check(
    "analyse récente resservie",
    fresh.status === 200 && fresh.cache === "hit" && fresh.body === MARKER,
    `HTTP ${fresh.status}, X-Cache=${fresh.cache}`,
  );
  check(
    "en-têtes de fraîcheur transmis",
    Boolean(fresh.generatedAt) && fresh.price === "123.45",
    `généré ${fresh.generatedAt}, cours ${fresh.price}`,
  );

  // 2. « Rafraîchir » ignore le cache : la route va jusqu'à l'appel modèle.
  //    Sans clé API elle répond 503, ce qui prouve déjà le contournement.
  const forced = await call(true);
  check(
    "rafraîchir contourne le cache",
    forced.cache !== "hit",
    forced.cache === "hit" ? "cache encore servi" : `HTTP ${forced.status}`,
  );

  // 3. Analyse trop vieille : considérée périmée.
  await seed(7 * 60 * 60 * 1000); // 7 heures, au-delà des 6 h
  const stale = await call(false);
  check(
    "analyse périmée non resservie",
    stale.cache !== "hit",
    stale.cache === "hit" ? "cache servi alors qu'il est périmé" : `HTTP ${stale.status}`,
  );
} catch (e) {
  console.error("ÉCHEC :", String(e).split("\n")[0]);
} finally {
  await sb.from("ai_analyses").delete().eq("user_id", USER).eq("ticker", TICKER);
}

console.log(`\n${"─".repeat(62)}`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.n.padEnd(32)} ${r.d}`);
const failed = results.filter((r) => !r.ok).length;
console.log("─".repeat(62));
console.log(`${results.length - failed}/${results.length} OK · ligne de test supprimée`);
process.exit(failed ? 1 : 0);
