"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  upsertCustomTicker, deleteCustomTicker, saveTelegramConfig,
  clearPortfolio, clearTransactions,
} from "@/lib/data";

export type ActionResult = { ok: boolean; message: string };

export async function addCustomTickerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const ticker = String(formData.get("ticker") ?? "").toUpperCase().trim();
  const nom = String(formData.get("nom") ?? "").trim() || ticker;

  if (!ticker) return { ok: false, message: "Saisis un ticker." };

  await upsertCustomTicker(user.username, { nom, ticker });
  revalidatePath("/parametres");
  revalidatePath("/screener");
  return { ok: true, message: `${nom} (${ticker}) ajouté à la watchlist.` };
}

export async function deleteCustomTickerAction(nom: string): Promise<void> {
  const user = await requireUser();
  await deleteCustomTicker(user.username, nom);
  revalidatePath("/parametres");
  revalidatePath("/screener");
}

export async function saveTelegramAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "").trim();
  const chat_id = String(formData.get("chat_id") ?? "").trim();

  await saveTelegramConfig(user.username, { token, chat_id });
  revalidatePath("/parametres");
  return { ok: true, message: "Configuration Telegram enregistrée." };
}

export async function testTelegramAction(
  token: string,
  chatId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!token || !chatId) {
    return { ok: false, message: "Renseigne le token et le chat ID." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ <b>Stock Analyzer</b> — la configuration Telegram fonctionne.",
        parse_mode: "HTML",
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      return { ok: false, message: `Telegram a refusé : ${json.description ?? "erreur"}` };
    }
    await saveTelegramConfig(user.username, { token, chat_id: chatId });
    revalidatePath("/parametres");
    return { ok: true, message: "Message envoyé — vérifie ton Telegram." };
  } catch {
    return { ok: false, message: "Impossible de joindre l'API Telegram." };
  }
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

  revalidatePath("/parametres");
  revalidatePath("/portefeuille");
  revalidatePath("/");

  const what =
    scope === "tout"
      ? "Portefeuille et historique supprimés."
      : scope === "positions"
        ? "Toutes les positions ont été supprimées."
        : "L'historique des transactions a été supprimé.";
  return { ok: true, message: what };
}
