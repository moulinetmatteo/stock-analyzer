import { getUser } from "@/lib/auth";
import { getPortfolio } from "@/lib/data";
import { PERIODS, type PeriodKey } from "@/lib/market/constants";
import { buildContext, streamAnalysis, hasApiKey } from "@/lib/ai/analyst";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Non authentifié", { status: 401 });

  if (!hasApiKey()) {
    return new Response(
      "Analyse IA non configurée : ANTHROPIC_API_KEY est absente côté serveur.",
      { status: 503 },
    );
  }

  let body: { ticker?: string; periode?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Corps de requête illisible", { status: 400 });
  }

  const ticker = String(body.ticker ?? "").toUpperCase().trim();
  const period = (body.periode ?? "3mo") as PeriodKey;

  if (!ticker) return new Response("Ticker manquant", { status: 400 });
  if (!(period in PERIODS)) return new Response("Période invalide", { status: 400 });

  // La position n'est ajoutée que si le lecteur détient réellement le titre.
  const position = (await getPortfolio(user.username)).find((p) => p.ticker === ticker);

  const built = await buildContext(ticker, period, position);
  if (!built) {
    return new Response(`Données de marché indisponibles pour ${ticker}`, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const messageStream = await streamAnalysis(built.context);

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
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
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[analyse-ia]", msg);
        controller.enqueue(encoder.encode(`\n\n⚠️ Analyse interrompue : ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
