"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { upsertAlert, deleteAlert } from "@/lib/data";

export type ActionResult = { ok: boolean; message: string };

export async function saveAlertAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const ticker = String(formData.get("ticker") ?? "").toUpperCase().trim();
  const nom = String(formData.get("nom") ?? "").trim() || ticker;
  const basRaw = formData.get("seuil_bas");
  const hautRaw = formData.get("seuil_haut");

  const bas = basRaw ? Number(basRaw) : null;
  const haut = hautRaw ? Number(hautRaw) : null;

  if (!ticker) return { ok: false, message: "Ticker manquant." };
  if (!bas && !haut) {
    return { ok: false, message: "Renseigne au moins un seuil." };
  }
  if (bas && haut && bas >= haut) {
    return { ok: false, message: "Le seuil d'achat doit être inférieur au seuil de vente." };
  }

  await upsertAlert(user.username, {
    ticker,
    nom,
    seuil_bas: bas && bas > 0 ? bas : null,
    seuil_haut: haut && haut > 0 ? haut : null,
  });

  revalidatePath("/alertes");
  revalidatePath("/");
  return { ok: true, message: `Alerte enregistrée pour ${nom}.` };
}

export async function deleteAlertAction(ticker: string): Promise<void> {
  const user = await requireUser();
  await deleteAlert(user.username, ticker);
  revalidatePath("/alertes");
  revalidatePath("/");
}
