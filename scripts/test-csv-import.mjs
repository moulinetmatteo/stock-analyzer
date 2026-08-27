/**
 * Import CSV de bout en bout, sur un compte jetable créé puis supprimé :
 * détection du format, conversion des ISIN, écriture en base, et surtout
 * re-import du même fichier pour vérifier que rien n'est dupliqué.
 *
 *   node scripts/test-csv-import.mjs <chemin.csv>
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

const FILE = process.argv[2] ?? `${process.env.HOME}/Downloads/Exportation de transactions.csv`;
const BASE = process.env.BASE ?? "http://localhost:3000";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const USER = "zz-csv-" + Math.random().toString(36).slice(2, 8);
let browser;

const count = async (table) => {
  const { count: n } = await sb.from(table).select("*", { count: "exact", head: true }).eq("user_id", USER);
  return n ?? 0;
};

async function runImport(page, label) {
  await page.goto(`${BASE}/portefeuille`, { waitUntil: "networkidle", timeout: 90000 });
  const tab = page.getByRole("tab", { name: "Transactions" });
  await tab.waitFor({ state: "visible", timeout: 60000 });
  await tab.click();
  await page.getByRole("button", { name: /Importer un CSV/ }).click();
  await page.setInputFiles('input[type="file"]', FILE);
  await page.waitForSelector("text=/Format détecté/", { timeout: 60000 });

  const before = await page.locator('table tbody tr td:nth-child(3) input')
    .evaluateAll((els) => [...new Set(els.map((e) => e.value))]);

  if (await page.getByRole("button", { name: /Convertir/ }).count()) {
    await page.getByRole("button", { name: /Convertir/ }).click();
    await page.waitForFunction(
      (old) => [...document.querySelectorAll('table tbody tr td:nth-child(3) input')]
        .map((e) => e.value).some((v) => !old.includes(v)),
      before, { timeout: 90000 },
    ).catch(() => {});
  }

  // Le toast de conversion est peut-être encore affiché : on attend spécifiquement
  // celui de l'import, sinon on lit le message précédent et on compte trop tôt.
  const importToast = page.locator("[data-sonner-toast]")
    .filter({ hasText: /importée|doublon|importable/i });

  await page.getByRole("button", { name: /^Importer \d+ ligne/ }).click();
  await importToast.first().waitFor({ state: "visible", timeout: 120000 });

  const toast = (await importToast.allTextContents()).join(" ");
  console.log(`${label} : ${toast.replace(/\s+/g, " ").trim().slice(0, 110)}`);
  return toast;
}

try {
  await sb.from("users").insert({
    username: USER, email: `${USER}@test.local`, name: "CSV",
    password_hash: bcrypt.hashSync("x".repeat(12), 10),
  });
  console.log(`compte jetable : ${USER}\n`);

  const exp = Date.now() + 86400_000;
  const pl = `${USER}.${exp}`;
  const token = `${pl}.${createHmac("sha256", env.SESSION_SECRET).update(pl).digest("base64url")}`;

  browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "sa_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  await runImport(page, "1er import ");
  const tx1 = await count("transactions");
  const pos1 = await count("portfolio");
  console.log(`             → ${tx1} transaction(s), ${pos1} position(s)\n`);

  await runImport(page, "2e import  ");
  const tx2 = await count("transactions");
  const pos2 = await count("portfolio");
  console.log(`             → ${tx2} transaction(s), ${pos2} position(s)\n`);

  const { data: positions } = await sb.from("portfolio").select("ticker,quantite,prix_achat").eq("user_id", USER);
  const isins = (positions ?? []).filter((p) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(p.ticker));

  console.log("─".repeat(60));
  console.log(`import réel        : ${tx1 > 0 ? "OK" : "ÉCHEC — rien écrit"}`);
  console.log(`anti-doublon       : ${tx2 === tx1 ? "OK" : `ÉCHEC — ${tx2 - tx1} doublon(s) créé(s)`}`);
  console.log(`tickers résolus    : ${isins.length === 0 ? "OK" : `ÉCHEC — ${isins.map((p) => p.ticker).join(", ")}`}`);
  console.log(`positions          : ${(positions ?? []).map((p) => p.ticker).join(", ")}`);
} catch (e) {
  console.error("ÉCHEC :", String(e).split("\n")[0].slice(0, 200));
} finally {
  if (browser) await browser.close();
  for (const t of ["transactions", "portfolio", "journal", "alerts", "watchlist_custom"]) {
    await sb.from(t).delete().eq("user_id", USER);
  }
  const { error } = await sb.from("users").delete().eq("username", USER);
  console.log(error ? `NETTOYAGE ÉCHOUÉ (${USER}) : ${error.message}` : "\ncompte jetable supprimé");
}
