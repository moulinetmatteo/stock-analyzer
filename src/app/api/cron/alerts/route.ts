import { timingSafeEqual } from "crypto";
import { runAlerts, runScan } from "@/lib/alerts/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Comparaison à durée constante : le secret ne doit pas fuir par le timing. */
function secretOk(given: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  const url = new URL(req.url);

  // Le secret peut venir de l'en-tête (GitHub Actions) ou de l'en-tête
  // Authorization (Vercel Cron), jamais de l'URL — elle finit dans les journaux.
  const header =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!secretOk(header)) {
    return Response.json({ error: "Secret invalide" }, { status: 401 });
  }

  const job = url.searchParams.get("job") ?? "alerts";
  if (job !== "alerts" && job !== "scan") {
    return Response.json({ error: "job doit valoir 'alerts' ou 'scan'" }, { status: 400 });
  }

    const dryRun = url.searchParams.get("dry") === "1";
  const started = Date.now();
  const summary =
    job === "scan" ? await runScan({ dryRun }) : await runAlerts({ dryRun });

  return Response.json(
    { job, dryRun, ...summary, durationMs: Date.now() - started },
    { status: summary.errors.length ? 207 : 200 },
  );
}

export const GET = handle;
export const POST = handle;
