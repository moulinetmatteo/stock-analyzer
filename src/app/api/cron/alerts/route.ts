import { timingSafeEqual } from "crypto";
import { runAlerts, runPriceAlerts, runRsiAlerts, runScan } from "@/lib/alerts/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type AuthResult = "ok" | "non-configure" | "manquant" | "invalide";

/**
 * Distingue les trois échecs possibles. Un « secret invalide » unique
 * obligerait à deviner si la variable manque côté serveur ou si les deux
 * valeurs diffèrent — deux corrections opposées.
 *
 * La comparaison reste à durée constante : le secret ne doit pas fuir par le
 * temps de réponse.
 */
function checkSecret(given: string | null): AuthResult {
  const expected = process.env.CRON_SECRET;
  if (!expected) return "non-configure";
  if (!given) return "manquant";

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalide";
  return "ok";
}

async function handle(req: Request) {
  const url = new URL(req.url);

  // Le secret peut venir de l'en-tête (GitHub Actions) ou de l'en-tête
  // Authorization (Vercel Cron), jamais de l'URL — elle finit dans les journaux.
  const header =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  const auth = checkSecret(header);
  if (auth !== "ok") {
    const messages: Record<Exclude<AuthResult, "ok">, string> = {
      "non-configure":
        "CRON_SECRET n'est pas définie côté serveur. Ajoute-la dans Vercel " +
        "(Settings → Environment Variables, portée Production) puis redéploie : " +
        "une variable ajoutée après coup ne s'applique pas au déploiement en cours.",
      manquant:
        "Aucun secret transmis. Envoie l'en-tête x-cron-secret.",
      invalide:
        "Le secret transmis ne correspond pas à CRON_SECRET côté serveur. " +
        "Vérifie que les deux valeurs sont identiques, sans espace ni retour à la ligne.",
    };
    return Response.json(
      { error: messages[auth], cause: auth },
      { status: auth === "non-configure" ? 503 : 401 },
    );
  }

  const JOBS = {
    prix: runPriceAlerts,   // seuils seuls — léger, peut tourner souvent
    rsi: runRsiAlerts,      // balayage de la watchlist — plus lourd
    scan: runScan,          // scan du matin
    alerts: runAlerts,      // prix + RSI, pour un lancement manuel
  } as const;

  const job = (url.searchParams.get("job") ?? "prix") as keyof typeof JOBS;
  if (!(job in JOBS)) {
    return Response.json(
      { error: `job doit valoir ${Object.keys(JOBS).join(", ")}` },
      { status: 400 },
    );
  }

    const dryRun = url.searchParams.get("dry") === "1";
  const started = Date.now();
  const summary = await JOBS[job]({ dryRun });

  return Response.json(
    { job, dryRun, ...summary, durationMs: Date.now() - started },
    { status: summary.errors.length ? 207 : 200 },
  );
}

export const GET = handle;
export const POST = handle;
