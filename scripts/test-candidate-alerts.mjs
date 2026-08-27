/**
 * Vérifie l'alerte « prix visé atteint » sans envoyer de vraie notification :
 * on insère un candidat dont la cible est volontairement au-dessus du cours,
 * on lance le cron en simulation, puis on nettoie.
 *
 *   node scripts/test-candidate-alerts.mjs [utilisateur]
 *
 * Prérequis : serveur de dev lancé, sql/candidates.sql exécuté dans Supabase.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const TICKER = "AAPL";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
let USER;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const check = (n, ok, d = "") => results.push({ n, ok, d });

async function run() {
  const res = await fetch(`${BASE}/api/cron/alerts?job=prix&dry=1`, {
    headers: { "x-cron-secret": env.CRON_SECRET },
  });
  return res.json();
}

async function seed(cible, notified = null) {
  await sb.from("candidates").upsert(
    {
      user_id: USER, ticker: TICKER, nom: "Apple (test)",
      these: "Candidat de test.", prix_cible: cible,
      prix_ajout: cible, conviction: 2, statut: "surveille",
      notified_date: notified,
    },
    { onConflict: "user_id,ticker" },
  );
}

try {
  const probe = await sb.from("candidates").select("id").limit(1);
  if (probe.error) {
    console.error(`Table absente : ${probe.error.message}`);
    console.error("Exécute sql/candidates.sql dans Supabase → SQL Editor.");
    process.exit(1);
  }

  // Le cron ne parcourt que les comptes ayant configuré Telegram : tester sur
  // un autre compte donnerait un silence trompeur.
  const { data: targets } = await sb
    .from("telegram_config").select("user_id,token,chat_id");
  const usable = (targets ?? []).filter((t) => t.token && t.chat_id);
  if (!usable.length) {
    console.error("Aucun compte n'a configuré Telegram — le cron n'a personne à notifier.");
    console.error("Renseigne un bot dans Paramètres, puis relance.");
    process.exit(1);
  }
  USER = process.argv[2] ?? usable[0].user_id;
  console.log(`compte testé : ${USER}\n`);

  // 1. Cible très au-dessus du cours : l'alerte doit partir.
  await seed(100000);
  const hit = await run();
  const fired = (hit.preview ?? []).some((m) => m.includes("Prix visé atteint"));
  check("cible atteinte → alerte", fired && hit.candidateAlerts > 0,
    `candidateAlerts=${hit.candidateAlerts}`);

  // 2. Déjà notifié aujourd'hui : silence.
  const today = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  await seed(100000, today);
  const again = await run();
  check("déjà notifié aujourd'hui → silence", again.candidateAlerts === 0,
    `candidateAlerts=${again.candidateAlerts}`);

  // 3. Cible sous le cours : rien à signaler.
  await seed(1);
  const below = await run();
  check("cible non atteinte → silence", below.candidateAlerts === 0,
    `candidateAlerts=${below.candidateAlerts}`);

  // 4. Candidat archivé : plus surveillé.
  await sb.from("candidates").update({ statut: "achete", prix_cible: 100000, notified_date: null })
    .eq("user_id", USER).eq("ticker", TICKER);
  const archived = await run();
  check("candidat archivé → non surveillé", archived.candidateAlerts === 0,
    `candidateAlerts=${archived.candidateAlerts}`);
} catch (e) {
  console.error("ÉCHEC :", String(e).split("\n")[0].slice(0, 160));
} finally {
  await sb.from("candidates").delete().eq("user_id", USER).eq("ticker", TICKER);
}

console.log(`\n${"─".repeat(60)}`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.n.padEnd(34)} ${r.d}`);
const failed = results.filter((r) => !r.ok).length;
console.log("─".repeat(60));
console.log(`${results.length - failed}/${results.length} OK · candidat de test supprimé`);
process.exit(failed ? 1 : 0);
