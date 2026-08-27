/**
 * Vérifie le thème clair et le rendu mobile, que les autres suites ne couvrent
 * pas : elles tournent toutes en sombre sur un écran large.
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
const pl = `${USER}.${exp}`;
const token = `${pl}.${createHmac("sha256", env.SESSION_SECRET).update(pl).digest("base64url")}`;

const results = [];
const check = (n, ok, d = "") => results.push({ n, ok, d });

const browser = await chromium.launch();
mkdirSync(SHOTS, { recursive: true });

async function session(viewport, theme) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([
    { name: "sa_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    // next-themes lit son choix dans localStorage ; on le pose via un cookie
    // impossible, donc on l'écrit avant le premier rendu.
  ]);
  await ctx.addInitScript((t) => {
    try { window.localStorage.setItem("theme", t); } catch { /* ignore */ }
  }, theme);
  return ctx;
}

// ── Thème clair, écran large ────────────────────────────────────────────────
{
  const ctx = await session({ width: 1400, height: 1000 }, "light");
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));

  await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1200);

  const cls = await p.evaluate(() => document.documentElement.className);
  const bg = await p.evaluate(() =>
    getComputedStyle(document.body).backgroundColor,
  );
  // En clair, le fond doit être lumineux : on lit la composante verte du rgb.
  const lum = Number((bg.match(/\d+/g) ?? ["0"])[1]);
  check("thème clair appliqué", cls.includes("light") || lum > 200, `class="${cls}" bg=${bg}`);

  await p.screenshot({ path: `${SHOTS}/light-dashboard.png`, fullPage: false });
  await p.goto(`${BASE}/screener`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${SHOTS}/light-screener.png`, fullPage: false });

  check("thème clair sans erreur JS", errs.length === 0, errs[0] ?? "");
  await ctx.close();
}

// ── Mobile, thème sombre ───────────────────────────────────────────────────
{
  const ctx = await session({ width: 390, height: 844 }, "dark");
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));

  await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1200);

  // La barre latérale doit disparaître au profit du bouton menu.
  const asideVisible = await p.locator("aside").isVisible().catch(() => false);
  const burger = p.getByRole("button", { name: /Ouvrir la navigation/ });
  const burgerVisible = await burger.isVisible().catch(() => false);
  check("sidebar masquée en mobile", !asideVisible, asideVisible ? "encore visible" : "");
  check("bouton menu présent", burgerVisible);

  // Pas de débordement horizontal.
  const overflow = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("aucun débordement horizontal", overflow <= 1, `${overflow}px`);

  await p.screenshot({ path: `${SHOTS}/mobile-dashboard.png`, fullPage: false });

  if (burgerVisible) {
    await burger.click();
    await p.waitForTimeout(700);
    const navVisible = await p.getByRole("link", { name: "Screener" }).isVisible().catch(() => false);
    check("tiroir s'ouvre", navVisible);
    await p.screenshot({ path: `${SHOTS}/mobile-drawer.png`, fullPage: false });
  }

  check("mobile sans erreur JS", errs.length === 0, errs[0] ?? "");
  await ctx.close();
}

await browser.close();

console.log(`\n${"─".repeat(64)}`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.n.padEnd(30)} ${r.d}`);
const failed = results.filter((r) => !r.ok).length;
console.log("─".repeat(64));
console.log(`${results.length - failed}/${results.length} OK · captures dans ${SHOTS}`);
process.exit(failed ? 1 : 0);
