/**
 * Deuxième passe : les états qu'on n'atteint qu'en interagissant — onglets du
 * portefeuille, tri et filtres du screener, sélecteur de période, ajout/retrait
 * dans la comparaison. Toujours en lecture seule.
 */
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { readFileSync, mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const USER = process.argv[2] ?? "demo";
const SHOTS = process.argv[3] ?? "/tmp/shots";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const exp = Date.now() + 30 * 86400 * 1000;
const payload = `${USER}.${exp}`;
const token = `${payload}.${createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url")}`;

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "sa_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
mkdirSync(SHOTS, { recursive: true });

const errors = [];
ctx.on("weberror", (e) => errors.push(String(e.error()).slice(0, 150)));

// ── Onglets du portefeuille ──────────────────────────────────────────────────
{
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`portefeuille: ${String(e).slice(0, 150)}`));
  await p.goto(`${BASE}/portefeuille`, { waitUntil: "networkidle", timeout: 90000 });

  for (const [tab, expect, shot] of [
    ["Transactions", "Importer un CSV", "pf-transactions"],
    ["Analyse", "Ratio de Sharpe", "pf-analyse"],
    ["Journal", "Thèse d'investissement", "pf-journal"],
  ]) {
    await p.getByRole("tab", { name: tab }).click();
    await p.waitForTimeout(1500);
    const body = await p.textContent("body");
    await p.screenshot({ path: `${SHOTS}/${shot}.png`, fullPage: true });
    check(`onglet ${tab}`, body.includes(expect), body.includes(expect) ? "" : `"${expect}" absent`);
  }

  // Le formulaire d'ajout doit s'ouvrir
  await p.getByRole("tab", { name: "Positions" }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Ajouter \/ modifier/ }).click();
  await p.waitForTimeout(400);
  const hasForm = await p.locator('input[name="quantite"]').isVisible();
  check("formulaire position", hasForm, hasForm ? "" : "champ quantité invisible");
  await p.close();
}

// ── Screener : recherche, filtre, tri ────────────────────────────────────────
{
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`screener: ${String(e).slice(0, 150)}`));
  await p.goto(`${BASE}/screener`, { waitUntil: "networkidle", timeout: 90000 });

  const rowsAll = await p.locator("tbody tr").count();

  await p.getByPlaceholder("Rechercher…").fill("apple");
  await p.waitForTimeout(500);
  const rowsSearch = await p.locator("tbody tr").count();
  check("recherche screener", rowsSearch > 0 && rowsSearch < rowsAll,
    `${rowsAll} → ${rowsSearch} ligne(s)`);

  await p.getByPlaceholder("Rechercher…").fill("");
  await p.getByRole("button", { name: "RSI > 70" }).click();
  await p.waitForTimeout(500);
  const rowsFilter = await p.locator("tbody tr").count();
  check("filtre RSI > 70", rowsFilter <= rowsAll, `${rowsFilter} ligne(s)`);

  await p.getByRole("button", { name: "Tous" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^Prix/ }).click();
  await p.waitForTimeout(500);
  const firstPrice = await p.locator("tbody tr td:nth-child(3)").first().textContent();
  const lastPrice = await p.locator("tbody tr td:nth-child(3)").last().textContent();
  const toNum = (s) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
  const sorted = toNum(firstPrice) >= toNum(lastPrice);
  check("tri par prix", sorted, `${firstPrice.trim()} … ${lastPrice.trim()}`);

  await p.screenshot({ path: `${SHOTS}/screener-sorted.png`, fullPage: true });
  await p.close();
}

// ── Sélecteur de période ─────────────────────────────────────────────────────
{
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`periode: ${String(e).slice(0, 150)}`));
  await p.goto(`${BASE}/analyse?ticker=MSFT`, { waitUntil: "networkidle", timeout: 90000 });
  await p.getByRole("button", { name: "1 an" }).click();
  await p.waitForURL(/periode=1y/, { timeout: 30000 });
  await p.waitForTimeout(2500);
  const charts = await p.locator("svg.recharts-surface").count();
  check("changement de période", charts >= 3, `${charts} graphique(s) après passage à 1 an`);
  await p.close();
}

// ── Comparaison : ajout et retrait ───────────────────────────────────────────
{
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`comparaison: ${String(e).slice(0, 150)}`));
  await p.goto(`${BASE}/comparaison?tickers=AAPL,MSFT`, { waitUntil: "networkidle", timeout: 90000 });
  const before = await p.locator("tbody tr").count();

  await p.getByRole("combobox").click();
  await p.waitForTimeout(400);
  await p.getByRole("option", { name: "NVIDIA", exact: true }).click();
  await p.waitForURL(/NVDA/, { timeout: 30000 });
  await p.waitForTimeout(2500);
  const after = await p.locator("tbody tr").count();
  check("ajout comparaison", after === before + 1, `${before} → ${after} titre(s)`);

  await p.screenshot({ path: `${SHOTS}/comparaison-3.png`, fullPage: true });
  await p.close();
}

await browser.close();

console.log(`\nUtilisateur : ${USER}\n${"─".repeat(70)}`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(26)} ${r.detail}`);
if (errors.length) {
  console.log(`\nErreurs JS (${errors.length}) :`);
  [...new Set(errors)].slice(0, 6).forEach((e) => console.log(`  · ${e}`));
}
const failed = results.filter((r) => !r.ok).length;
console.log("─".repeat(70));
console.log(`${results.length - failed}/${results.length} OK${errors.length ? ` · ${errors.length} erreur(s) JS` : " · aucune erreur JS"}`);
process.exit(failed || errors.length ? 1 : 0);
