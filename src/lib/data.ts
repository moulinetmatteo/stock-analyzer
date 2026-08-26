import "server-only";
import { supabase } from "./supabase/server";

export type Position = {
  ticker: string;
  nom: string;
  quantite: number;
  prix_achat: number;
};

export type Transaction = {
  id: string;
  date: string;
  ticker: string;
  nom: string;
  action: "achat" | "vente";
  quantite: number;
  prix: number;
  montant: number;
};

export type Alert = {
  ticker: string;
  nom: string;
  seuil_bas: number | null;
  seuil_haut: number | null;
};

export type JournalEntry = {
  ticker: string;
  note: string;
  target_price: number | null;
  review_date: string | null;
};

export type CustomTicker = { nom: string; ticker: string };

// ── Portefeuille ──────────────────────────────────────────────────────────────

export async function getPortfolio(uid: string): Promise<Position[]> {
  const { data } = await supabase
    .from("portfolio")
    .select("ticker,nom,quantite,prix_achat")
    .eq("user_id", uid);
  return data ?? [];
}

export async function upsertPosition(uid: string, p: Position) {
  await supabase
    .from("portfolio")
    .upsert({ user_id: uid, ...p }, { onConflict: "user_id,ticker" });
}

export async function deletePosition(uid: string, ticker: string) {
  await supabase.from("portfolio").delete().eq("user_id", uid).eq("ticker", ticker);
}

export async function clearPortfolio(uid: string) {
  await supabase.from("portfolio").delete().eq("user_id", uid);
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function getTransactions(uid: string): Promise<Transaction[]> {
  const { data } = await supabase
    .from("transactions")
    .select("id,date,ticker,nom,action,quantite,prix,montant")
    .eq("user_id", uid)
    .order("date", { ascending: false });
  return (data ?? []) as Transaction[];
}

export async function addTransaction(uid: string, tx: Transaction) {
  await supabase.from("transactions").insert({ user_id: uid, ...tx });
}

export async function addTransactions(uid: string, txs: Transaction[]) {
  if (!txs.length) return;
  await supabase.from("transactions").insert(txs.map((t) => ({ user_id: uid, ...t })));
}

export async function deleteTransaction(uid: string, id: string) {
  await supabase.from("transactions").delete().eq("user_id", uid).eq("id", id);
}

export async function clearTransactions(uid: string) {
  await supabase.from("transactions").delete().eq("user_id", uid);
}

/**
 * Empreintes des transactions existantes, pour bloquer les ré-imports.
 * Une transaction est un doublon si date+ticker+sens+quantité+prix coïncident.
 */
export function fingerprint(t: {
  date: string;
  ticker: string;
  action: string;
  quantite: number;
  prix: number;
}): string {
  return [
    t.date,
    t.ticker.toUpperCase(),
    t.action.toLowerCase(),
    t.quantite.toFixed(4),
    t.prix.toFixed(4),
  ].join("|");
}

export async function getFingerprints(uid: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("transactions")
    .select("date,ticker,action,quantite,prix")
    .eq("user_id", uid);
  return new Set((data ?? []).map(fingerprint));
}

// ── Alertes ───────────────────────────────────────────────────────────────────

export async function getAlerts(uid: string): Promise<Alert[]> {
  const { data } = await supabase
    .from("alerts")
    .select("ticker,nom,seuil_bas,seuil_haut")
    .eq("user_id", uid);
  return data ?? [];
}

export async function upsertAlert(uid: string, a: Alert) {
  await supabase
    .from("alerts")
    .upsert({ user_id: uid, ...a }, { onConflict: "user_id,ticker" });
}

export async function deleteAlert(uid: string, ticker: string) {
  await supabase.from("alerts").delete().eq("user_id", uid).eq("ticker", ticker);
}

// ── Watchlist personnalisée ───────────────────────────────────────────────────

export async function getCustomWatchlist(uid: string): Promise<CustomTicker[]> {
  const { data } = await supabase
    .from("watchlist_custom")
    .select("nom,ticker")
    .eq("user_id", uid);
  return data ?? [];
}

export async function upsertCustomTicker(uid: string, c: CustomTicker) {
  await supabase
    .from("watchlist_custom")
    .upsert({ user_id: uid, ...c }, { onConflict: "user_id,nom" });
}

export async function deleteCustomTicker(uid: string, nom: string) {
  await supabase.from("watchlist_custom").delete().eq("user_id", uid).eq("nom", nom);
}

// ── Journal ───────────────────────────────────────────────────────────────────

export async function getJournal(uid: string): Promise<JournalEntry[]> {
  const { data } = await supabase
    .from("journal")
    .select("ticker,note,target_price,review_date")
    .eq("user_id", uid);
  return data ?? [];
}

export async function saveJournal(uid: string, e: JournalEntry) {
  await supabase
    .from("journal")
    .upsert({ user_id: uid, ...e }, { onConflict: "user_id,ticker" });
}

// ── Telegram ──────────────────────────────────────────────────────────────────

export type TelegramConfig = { token: string; chat_id: string };

export async function getTelegramConfig(uid: string): Promise<TelegramConfig | null> {
  const { data } = await supabase
    .from("telegram_config")
    .select("token,chat_id")
    .eq("user_id", uid)
    .maybeSingle();
  return data ?? null;
}

export async function saveTelegramConfig(uid: string, c: TelegramConfig) {
  await supabase
    .from("telegram_config")
    .upsert({ user_id: uid, ...c }, { onConflict: "user_id" });
}

/**
 * Applique une transaction à la position courante : PRU pondéré à l'achat,
 * réduction (et suppression à zéro) à la vente.
 */
export function applyToPosition(
  current: Position | undefined,
  tx: Pick<Transaction, "ticker" | "nom" | "action" | "quantite" | "prix">,
): Position | null {
  const pos = current ?? {
    ticker: tx.ticker,
    nom: tx.nom,
    quantite: 0,
    prix_achat: tx.prix,
  };

  if (tx.action === "achat") {
    const qty = pos.quantite + tx.quantite;
    const pru = qty > 0 ? (pos.quantite * pos.prix_achat + tx.quantite * tx.prix) / qty : tx.prix;
    return { ticker: tx.ticker, nom: tx.nom, quantite: qty, prix_achat: pru };
  }

  const qty = Math.max(0, pos.quantite - tx.quantite);
  if (qty === 0) return null;
  return { ticker: tx.ticker, nom: pos.nom, quantite: qty, prix_achat: pos.prix_achat };
}
