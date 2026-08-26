import { NextResponse } from "next/server";
import { checkConfig } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Vérifie que le serveur est correctement configuré. Ne renvoie que des noms de
 * variables et des messages d'erreur — jamais une valeur de secret.
 */
export async function GET() {
  const { ok, problems } = await checkConfig();
  return NextResponse.json(
    { ok, problems, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
