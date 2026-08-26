import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur. On utilise la clé service pour contourner RLS :
 * l'isolation entre utilisateurs est assurée applicativement par le filtre
 * `user_id` dans chaque requête (cf. lib/data.ts), jamais par le client.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
