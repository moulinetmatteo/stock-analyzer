"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  getCandidates, upsertCandidate, deleteCandidate,
  type CandidateStatus,
} from "@/lib/data";
import { getEurUsd, getSnapshot } from "@/lib/market/quotes";

export type ActionResult = { ok: boolean; message: string };

const STATUTS: CandidateStatus[] = ["surveille", "achete", "abandonne"];

export async function saveCandidateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const ticker = String(formData.get("ticker") ?? "").toUpperCase().trim();
  if (!ticker) return { ok: false, message: "Ticker manquant." };

  const existing = (await getCandidates(user.username)).find((c) => c.ticker === ticker);

  // Le cours de référence n'est capté qu'à la création : le figer à chaque
  // modification effacerait le point de comparaison.
  let prixAjout = existing?.prix_ajout ?? null;
  if (prixAjout === null) {
    const snap = await getSnapshot(ticker, "1mo", await getEurUsd());
    prixAjout = snap?.priceEur ?? null;
  }

  const cible = formData.get("prix_cible");
  const statut = String(formData.get("statut") ?? "surveille") as CandidateStatus;

  const saved = await upsertCandidate(user.username, {
    ticker,
    nom: String(formData.get("nom") ?? "").trim() || ticker,
    these: String(formData.get("these") ?? "").trim(),
    prix_cible: cible && Number(cible) > 0 ? Number(cible) : null,
    prix_ajout: prixAjout,
    conviction: Math.min(Math.max(Number(formData.get("conviction") ?? 2), 1), 3),
    statut: STATUTS.includes(statut) ? statut : "surveille",
    note_sortie: String(formData.get("note_sortie") ?? "").trim(),
  });

  if (!saved.ok) {
    return {
      ok: false,
      message: saved.error?.includes("candidates")
        ? "La table candidates n'existe pas encore. Exécute sql/candidates.sql dans Supabase."
        : `Enregistrement impossible : ${saved.error}`,
    };
  }

  revalidatePath("/candidats");
  return { ok: true, message: existing ? "Candidat mis à jour." : `${ticker} sous surveillance.` };
}

export async function setStatusAction(
  ticker: string,
  statut: CandidateStatus,
  note: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const existing = (await getCandidates(user.username)).find((c) => c.ticker === ticker);
  if (!existing) return { ok: false, message: "Candidat introuvable." };

  const saved = await upsertCandidate(user.username, {
    ticker: existing.ticker,
    nom: existing.nom,
    these: existing.these,
    prix_cible: existing.prix_cible,
    prix_ajout: existing.prix_ajout,
    conviction: existing.conviction,
    statut,
    note_sortie: note.trim(),
  });

  if (!saved.ok) return { ok: false, message: `Mise à jour impossible : ${saved.error}` };

  revalidatePath("/candidats");
  return { ok: true, message: "Statut mis à jour." };
}

export async function deleteCandidateAction(ticker: string): Promise<void> {
  const user = await requireUser();
  await deleteCandidate(user.username, ticker);
  revalidatePath("/candidats");
}
