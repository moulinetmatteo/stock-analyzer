import { getUser } from "@/lib/auth";
import { getPortfolio, getCachedAnalysis, saveAnalysis } from "@/lib/data";
import { PERIODS, type PeriodKey } from "@/lib/market/constants";
import { buildContext, streamAnalysis, hasApiKey } from "@/lib/ai/analyst";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Au-delà de ce délai l'analyse est rejouée : le cours a bougé, et une lecture
 * d'indicateurs vieille d'une demi-journée décrit un autre marché. En deçà,
 * recliquer sert la version conservée plutôt qu'un appel facturé de plus.
 */
const TTL_MS = 6 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Non authentifié", { status: 401 });

  let body: { ticker?: string; periode?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response("Corps de requête illisible", { status: 400 });
  }

  const ticker = String(body.ticker ?? "").toUpperCase().trim();
  const period = (body.periode ?? "3mo") as PeriodKey;

  if (!ticker) return new Response("Ticker manquant", { status: 400 });
  if (!(period in PERIODS)) return new Response("Période invalide", { status: 400 });

  // ── Cache ─────────────────────────────────────────────────────────────────
  // Consulté avant la clé API : une analyse déjà payée reste lisible même si la
  // clé a été retirée depuis.
  if (!body.force) {
    const cached = await getCachedAnalysis(user.username, ticker, period);
    if (cached && Date.now() - new Date(cached.created_at).getTime() < TTL_MS) {
      return new Response(cached.content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Cache": "hit",
          "X-Generated-At": cached.created_at,
          ...(cached.price_eur !== null
            ? { "X-Generated-Price": String(cached.price_eur) }
            : {}),
        },
      });
    }
  }

  if (!hasApiKey()) {
    return new Response(
      "Analyse IA non configurée : ANTHROPIC_API_KEY est absente côté serveur.",
      { status: 503 },
    );
  }

  const position = (await getPortfolio(user.username)).find((p) => p.ticker === ticker);
  const built = await buildContext(ticker, period, position);
  if (!built) {
    return new Response(`Données de marché indisponibles pour ${ticker}`, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let complete = false;

      try {
        const messageStream = await streamAnalysis(built.context);

        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await messageStream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\n(Le modèle a décliné cette demande. Reformule ou change de titre.)",
            ),
          );
        } else {
          complete = true;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[analyse-ia]", msg);
        controller.enqueue(encoder.encode(`\n\n⚠️ Analyse interrompue : ${msg}`));
      } finally {
        controller.close();
      }

      // Une analyse tronquée ou refusée n'est pas mise en cache : on ne veut pas
      // servir un texte incomplet pendant six heures.
      if (complete && full.trim()) {
        try {
          await saveAnalysis(user.username, ticker, period, full, built.priceEur);
        } catch (e) {
          console.error("[analyse-ia] cache non écrit :", e);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Cache": "miss",
      "X-Accel-Buffering": "no",
    },
  });
}
