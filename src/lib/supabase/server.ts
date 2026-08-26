import "server-only";
import { createClient } from "@supabase/supabase-js";

export type KeyKind = "service_role" | "anon" | "inconnue";

/**
 * Nature d'une clé Supabase, sans appel réseau.
 *
 * Distinguer les deux est essentiel : la clé anon est soumise à RLS, donc un
 * SELECT filtré renvoie zéro ligne *sans erreur*. Utilisée par mégarde, elle
 * fait échouer les connexions avec un message « identifiants incorrects »
 * trompeur, et bloque les insertions sur une violation de RLS.
 */
export function keyKind(key: string | undefined): KeyKind {
  if (!key) return "inconnue";
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";
  if (key.startsWith("eyJ")) {
    try {
      const claims = JSON.parse(
        Buffer.from(key.split(".")[1], "base64").toString("utf8"),
      );
      if (claims.role === "service_role") return "service_role";
      if (claims.role === "anon") return "anon";
    } catch { /* clé illisible */ }
  }
  return "inconnue";
}

export const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

/**
 * Client Supabase côté serveur. Il lui faut la clé `service_role` : l'isolation
 * entre comptes est assurée applicativement par le filtre `user_id` de chaque
 * requête (cf. lib/data.ts), et jamais par RLS.
 *
 * Aucun repli sur la clé anon : mieux vaut un diagnostic clair via /api/health
 * qu'un client qui semble fonctionner mais ne voit aucune ligne.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
