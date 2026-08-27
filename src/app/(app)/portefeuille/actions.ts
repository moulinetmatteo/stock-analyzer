"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import {
  getPortfolio, upsertPosition, deletePosition, clearPortfolio,
  addTransaction, addTransactions, deleteTransaction, clearTransactions,
  getFingerprints, fingerprint, saveJournal, applyToPosition,
  type Transaction, type Position,
} from "@/lib/data";
import { isinToYahoo } from "@/lib/market/quotes";

export type ActionResult = { ok: boolean; message: string };

export async function savePositionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const ticker = String(formData.get("ticker") ?? "").toUpperCase().trim();
  const nom = String(formData.get("nom") ?? "").trim() || ticker;
  const quantite = Number(formData.get("quantite"));
  const prix_achat = Number(formData.get("prix_achat"));

  if (!ticker) return { ok: false, message: "Ticker manquant." };
  if (!(quantite > 0) || !(prix_achat > 0)) {
    return { ok: false, message: "Quantité et prix doivent être positifs." };
  }

  await upsertPosition(user.username, { ticker, nom, quantite, prix_achat });
  revalidatePath("/portefeuille");
  revalidatePath("/");
  return { ok: true, message: `Position ${nom} enregistrée.` };
}

export async function deletePositionAction(ticker: string): Promise<void> {
  const user = await requireUser();
  await deletePosition(user.username, ticker);
  revalidatePath("/portefeuille");
  revalidatePath("/");
}

export async function addTransactionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const ticker = String(formData.get("ticker") ?? "").toUpperCase().trim();
  const nom = String(formData.get("nom") ?? "").trim() || ticker;
  const action = String(formData.get("action") ?? "achat") as "achat" | "vente";
  const date = String(formData.get("date") ?? "");
  const quantite = Number(formData.get("quantite"));
  const prix = Number(formData.get("prix"));

  if (!ticker || !date) return { ok: false, message: "Ticker et date requis." };
  if (!(quantite > 0) || !(prix > 0)) {
    return { ok: false, message: "Quantité et prix doivent être positifs." };
  }

  const tx: Transaction = {
    id: randomUUID().slice(0, 8),
    date, ticker, nom, action, quantite, prix,
    montant: Number((quantite * prix).toFixed(2)),
  };

  await addTransaction(user.username, tx);

  const portfolio = await getPortfolio(user.username);
  const current = portfolio.find((p) => p.ticker === ticker);
  const next = applyToPosition(current, tx);
  if (next) await upsertPosition(user.username, next);
  else await deletePosition(user.username, ticker);

  revalidatePath("/portefeuille");
  revalidatePath("/");
  return { ok: true, message: "Transaction enregistrée, position mise à jour." };
}

export async function deleteTransactionAction(id: string): Promise<void> {
  const user = await requireUser();
  await deleteTransaction(user.username, id);
  revalidatePath("/portefeuille");
}

export async function saveJournalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const ticker = String(formData.get("ticker") ?? "");
  const note = String(formData.get("note") ?? "");
  const targetRaw = formData.get("target_price");
  const target = targetRaw ? Number(targetRaw) : null;
  const review = String(formData.get("review_date") ?? "") || null;

  await saveJournal(user.username, {
    ticker,
    note,
    target_price: target && target > 0 ? target : null,
    review_date: review,
  });
  revalidatePath("/portefeuille");
  return { ok: true, message: "Journal enregistré." };
}

export async function clearDataAction(
  scope: "transactions" | "positions" | "tout",
): Promise<ActionResult> {
  const user = await requireUser();
  if (scope === "transactions" || scope === "tout") {
    await clearTransactions(user.username);
  }
  if (scope === "positions" || scope === "tout") {
    await clearPortfolio(user.username);
  }
  revalidatePath("/portefeuille");
  revalidatePath("/");
  return { ok: true, message: "Données supprimées." };
}

// ── Import CSV ────────────────────────────────────────────────────────────────

export type ParsedRow = {
  date: string;
  nom: string;
  ticker: string;
  action: "achat" | "vente";
  quantite: number;
  prix: number;
  montant: number;
  isIsin: boolean;
};

export type ParseResult = {
  ok: boolean;
  broker: string;
  rows: ParsedRow[];
  message: string;
};

function normalize(h: string) {
  return h.toLowerCase().trim().replace(/^﻿/, "");
}

/** Découpage CSV tolérant aux guillemets et au séparateur (`,` ou `;`). */
function splitCsv(text: string): string[][] {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) >
    (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === sep) { row.push(cell); cell = ""; continue; }
    if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((x) => x.trim())) rows.push(row);
      row = []; cell = "";
      continue;
    }
    cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const num = (v: string) => Number(String(v).replace(/\s/g, "").replace(",", "."));
const isIsin = (v: string) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(v.trim().toUpperCase());

export async function parseCsvAction(formData: FormData): Promise<ParseResult> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, broker: "", rows: [], message: "Aucun fichier reçu." };
  }

  const text = await file.text();
  const table = splitCsv(text);
  if (table.length < 2) {
    return { ok: false, broker: "", rows: [], message: "Fichier vide ou illisible." };
  }

  const headers = table[0].map(normalize);
  const idx = (name: string) => headers.indexOf(name);
  const has = (...names: string[]) => names.every((n) => idx(n) >= 0);
  const body = table.slice(1);
  const cell = (r: string[], name: string) => (r[idx(name)] ?? "").trim();

  let broker = "Générique";
  let rows: ParsedRow[] = [];

  if (has("category", "type", "shares", "price", "symbol")) {
    // ── Trade Republic / Scalable Capital ─────────────────────────────────────
    // Les deux néobrokers exportent le même schéma ; `mcc_code` et
    // `payment_reference` n'apparaissent que chez Trade Republic.
    broker = has("mcc_code") || has("payment_reference")
      ? "Trade Republic"
      : "Trade Republic / Scalable Capital";
    rows = body
      .filter((r) => cell(r, "category") === "TRADING")
      .filter((r) => ["BUY", "SELL"].includes(cell(r, "type")))
      .map((r) => {
        const q = Math.abs(num(cell(r, "shares")));
        const p = Math.abs(num(cell(r, "price")));
        const sym = cell(r, "symbol").toUpperCase();
        const dateRaw = cell(r, "date") || cell(r, "datetime");
        return {
          date: dateRaw.slice(0, 10),
          nom: cell(r, "name") || sym,
          ticker: sym,
          action: cell(r, "type") === "BUY" ? ("achat" as const) : ("vente" as const),
          quantite: q,
          prix: p,
          montant: Number((q * p).toFixed(2)),
          isIsin: isIsin(sym),
        };
      });
  } else if (has("quantité", "cours", "produit")) {
    // ── Degiro (export français) ──────────────────────────────────────────────
    broker = "Degiro";
    rows = body.map((r) => {
      const qRaw = num(cell(r, "quantité"));
      const p = Math.abs(num(cell(r, "cours")));
      const sym = (cell(r, "isin") || "").toUpperCase();
      return {
        date: (cell(r, "date") || "").slice(0, 10),
        nom: cell(r, "produit"),
        ticker: sym,
        action: qRaw > 0 ? ("achat" as const) : ("vente" as const),
        quantite: Math.abs(qRaw),
        prix: p,
        montant: Number((Math.abs(qRaw) * p).toFixed(2)),
        isIsin: isIsin(sym),
      };
    });
  } else if (has("date", "ticker", "action", "quantite", "prix")) {
    // ── Format générique ──────────────────────────────────────────────────────
    rows = body.map((r) => {
      const q = Math.abs(num(cell(r, "quantite")));
      const p = Math.abs(num(cell(r, "prix")));
      const sym = cell(r, "ticker").toUpperCase();
      const a = cell(r, "action").toLowerCase();
      return {
        date: cell(r, "date").slice(0, 10),
        nom: cell(r, "nom") || sym,
        ticker: sym,
        action: a.startsWith("v") || a.startsWith("s") ? ("vente" as const) : ("achat" as const),
        quantite: q,
        prix: p,
        montant: Number((q * p).toFixed(2)),
        isIsin: isIsin(sym),
      };
    });
  } else {
    return {
      ok: false,
      broker: "",
      rows: [],
      message:
        "Format non reconnu. Colonnes attendues : date, ticker, action, quantite, prix.",
    };
  }

  rows = rows.filter(
    (r) => r.date && Number.isFinite(r.quantite) && r.quantite > 0 && Number.isFinite(r.prix),
  );

  if (!rows.length) {
    return { ok: false, broker, rows: [], message: "Aucune ligne exploitable." };
  }

  const isinCount = rows.filter((r) => r.isIsin).length;
  return {
    ok: true,
    broker,
    rows,
    message: isinCount
      ? `${rows.length} ligne(s) · ${isinCount} code(s) ISIN à convertir.`
      : `${rows.length} ligne(s) prêtes à importer.`,
  };
}

export async function convertIsinsAction(rows: ParsedRow[]): Promise<ParsedRow[]> {
  await requireUser();

  // Un même ISIN revient sur des dizaines de lignes : on ne l'interroge qu'une fois.
  const unique = [...new Set(rows.filter((r) => r.isIsin).map((r) => r.ticker))];
  const resolved = new Map<string, string>();
  for (const isin of unique) {
    resolved.set(isin, await isinToYahoo(isin));
  }

  // On renvoie de nouveaux objets plutôt que de muter ceux reçus : React
  // déduplique les valeurs qui traversent la frontière serveur/client, et rendrait
  // au client ses propres objets d'origine — les mutations seraient invisibles.
  return rows.map((r) => {
    if (!r.isIsin) return r;
    const hit = resolved.get(r.ticker);
    if (!hit || hit === r.ticker) return r;
    return { ...r, ticker: hit.toUpperCase(), isIsin: false };
  });
}

export async function importRowsAction(rows: ParsedRow[]): Promise<ActionResult> {
  const user = await requireUser();

  const seen = await getFingerprints(user.username);
  const portfolio = new Map<string, Position>(
    (await getPortfolio(user.username)).map((p) => [p.ticker, p]),
  );

  const toInsert: Transaction[] = [];
  let duplicates = 0;
  let skipped = 0;

  // Les positions se calculent dans l'ordre chronologique, sinon le PRU est faux.
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  for (const r of ordered) {
    const ticker = r.ticker.toUpperCase().trim();
    if (!ticker || ticker.length < 2 || isIsin(ticker)) { skipped++; continue; }

    const fp = fingerprint({ ...r, ticker });
    if (seen.has(fp)) { duplicates++; continue; }
    seen.add(fp);

    toInsert.push({
      id: randomUUID().slice(0, 8),
      date: r.date,
      ticker,
      nom: r.nom || ticker,
      action: r.action,
      quantite: r.quantite,
      prix: r.prix,
      montant: r.montant,
    });

    const next = applyToPosition(portfolio.get(ticker), {
      ticker, nom: r.nom || ticker, action: r.action, quantite: r.quantite, prix: r.prix,
    });
    if (next) portfolio.set(ticker, next);
    else portfolio.delete(ticker);
  }

  if (!toInsert.length) {
    const why = duplicates
      ? `${duplicates} doublon(s) ignoré(s) — rien de nouveau à importer.`
      : "Aucune ligne importable.";
    return { ok: false, message: why };
  }

  await addTransactions(user.username, toInsert);

  const touched = new Set(toInsert.map((t) => t.ticker));
  for (const ticker of touched) {
    const pos = portfolio.get(ticker);
    if (pos) await upsertPosition(user.username, pos);
    else await deletePosition(user.username, ticker);
  }

  const parts = [`${toInsert.length} transaction(s) importée(s)`];
  if (duplicates) parts.push(`${duplicates} doublon(s) ignoré(s)`);
  if (skipped) parts.push(`${skipped} ligne(s) sans ticker valide`);

  revalidatePath("/portefeuille");
  revalidatePath("/");
  return { ok: true, message: parts.join(" · ") };
}
