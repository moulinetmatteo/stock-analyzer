/**
 * Test de fumée end-to-end : visite chaque page en session authentifiée et
 * remonte les erreurs console, les requêtes en échec et les écrans vides.
 *
 * Le cookie de session est forgé avec SESSION_SECRET plutôt que via le
 * formulaire, pour ne pas dépendre d'un mot de passe en clair. Le test reste
 * strictement en lecture : aucune écriture en base.
 */
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { readFileSync, mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const USER = process.argv[2] ?? "demo";
const SHOTS = process.argv[3] ?? "/tmp/shots";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

function sessionToken(username) {
  const exp = Date.now() + 30 * 86400 * 1000;
  const payload = `${username}.${exp}`;
  const sig = createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

const PAGES = [
  { path: "/", name: "dashboard", expect: ["Dashboard", "Heatmap"] },
  { path: "/screener", name: "screener", expect: ["Screener", "Signal"] },
  { path: "/analyse?ticker=AAPL", name: "analyse", expect: ["RSI", "Signal global"] },
  { path: "/comparaison?tickers=AAPL,MSFT", name: "comparaison", expect: ["Performance relative"] },
  { path: "/portefeuille", name: "portefeuille", expect: ["Positions", "Valeur totale"] },
  { path: "/backtesting?ticker=AAPL&run=1", name: "backtesting", expect: ["Courbe de capital", "Buy & hold"] },
  { path: "/alertes", name: "alertes", expect: ["Alertes prix"] },
  { path: "/parametres", name: "parametres", expect: ["Watchlist personnalisée", "Zone de danger"] },
];

const results = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{
  name: "sa_session", value: sessionToken(USER),
  domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax",
}]);
mkdirSync(SHOTS, { recursive: true });

// ── 1. Le formulaire rejette un mauvais mot de passe ─────────────────────────
{
  const anon = await browser.newContext();
  const p = await anon.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="username"]', USER);
  await p.fill('input[name="password"]', "mauvais-mot-de-passe");
  await p.click('button[type="submit"]');
  await p.waitForTimeout(2500);
  const rejected = (await p.content()).includes("Identifiants incorrects");
  results.push({ name: "login (mauvais mdp)", ok: rejected, detail: rejected ? "rejeté correctement" : "PAS de message d'erreur" });
  await anon.close();
}

// ── 2. Chaque page authentifiée ──────────────────────────────────────────────
for (const spec of PAGES) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("requestfailed", (r) => failedRequests.push(`${r.method()} ${r.url().slice(0, 90)}`));

  const t0 = Date.now();
  let status = 0;
  try {
    const resp = await page.goto(`${BASE}${spec.path}`, { waitUntil: "networkidle", timeout: 90000 });
    status = resp?.status() ?? 0;
  } catch (e) {
    results.push({ name: spec.name, ok: false, detail: `navigation échouée: ${String(e).slice(0, 120)}` });
    await page.close();
    continue;
  }
  const ms = Date.now() - t0;

  await page.waitForTimeout(1200); // laisse les graphiques Recharts se peindre
  const body = await page.textContent("body");
  const missing = spec.expect.filter((t) => !body.includes(t));
  const charts = await page.locator("svg.recharts-surface").count();
  await page.screenshot({ path: `${SHOTS}/${spec.name}.png`, fullPage: true });

  results.push({
    name: spec.name,
    ok: status === 200 && missing.length === 0 && consoleErrors.length === 0,
    detail: [
      `HTTP ${status}`,
      `${(ms / 1000).toFixed(1)}s`,
      `${charts} graphique(s)`,
      missing.length ? `MANQUE: ${missing.join(", ")}` : null,
      consoleErrors.length ? `ERREURS CONSOLE: ${consoleErrors.slice(0, 3).join(" | ")}` : null,
      failedRequests.length ? `REQ ÉCHOUÉES: ${failedRequests.slice(0, 2).join(" | ")}` : null,
    ].filter(Boolean).join(" · "),
  });
  await page.close();
}

await browser.close();

console.log(`\nUtilisateur testé : ${USER}\n${"─".repeat(78)}`);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(22)} ${r.detail}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log("─".repeat(78));
console.log(`${results.length - failed}/${results.length} OK · captures dans ${SHOTS}`);
process.exit(failed ? 1 : 0);
