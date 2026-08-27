"use client";

import { useRef, useState } from "react";
import { RefreshCw, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/stat-card";
import type { PeriodKey } from "@/lib/market/constants";

type Status = "idle" | "streaming" | "done" | "error";

/** Âge d'une analyse conservée, en français courant. */
function ageLabel(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.round(mins / 60);
  return `il y a ${h} h`;
}

export function AiAnalysis({
  ticker,
  period,
  label,
}: {
  ticker: string;
  period: PeriodKey;
  label: string;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [cachedPrice, setCachedPrice] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(force = false) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText("");
    setCachedAt(null);
    setCachedPrice(null);
    setStatus("streaming");

    try {
      const res = await fetch("/api/analyse-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, periode: period, force }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setText(await res.text());
        setStatus("error");
        return;
      }

      // Une analyse servie depuis le cache arrive d'un bloc : inutile de
      // simuler une frappe, on l'affiche telle quelle.
      if (res.headers.get("X-Cache") === "hit") {
        setText(await res.text());
        setCachedAt(res.headers.get("X-Generated-At"));
        const p = res.headers.get("X-Generated-Price");
        setCachedPrice(p ? Number(p) : null);
        setStatus("done");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
      setStatus("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // Interruption volontaire : on garde ce qui est déjà écrit.
        setStatus(text ? "done" : "idle");
        return;
      }
      setText(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  const streaming = status === "streaming";

  return (
    <section className="surface-card p-5">
      <SectionTitle
        aside={
          status !== "done" ? undefined : cachedAt ? "en cache" : "généré par Claude"
        }
      >
        <span className="inline-flex items-center gap-2">
          <Sparkles className="text-primary size-4" />
          Lecture des indicateurs
        </span>
      </SectionTitle>

      {status === "idle" && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Claude met en relation les indicateurs affichés ci-dessus pour {label} —
            ce sur quoi ils s&apos;accordent, ce sur quoi ils divergent, et les niveaux
            qui comptent. Il n&apos;a accès qu&apos;aux chiffres de cette page.
          </p>
          <Button size="sm" onClick={() => run()}>
            <Sparkles className="size-4" />
            Lancer l&apos;analyse
          </Button>
        </div>
      )}

      {status !== "idle" && (
        <div className="space-y-4">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {text}
            {streaming && (
              <span className="bg-foreground/70 ml-0.5 inline-block h-4 w-[2px] animate-pulse align-text-bottom" />
            )}
          </div>

          {streaming && !text && (
            <p className="text-muted-foreground text-sm">Lecture des indicateurs…</p>
          )}

          <div className="flex items-center gap-2">
            {streaming ? (
              <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
                <Square className="size-3.5" />
                Arrêter
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => run(true)}>
                <RefreshCw className="size-3.5" />
                {cachedAt ? "Rafraîchir" : "Relancer"}
              </Button>
            )}
            {status === "done" && (
              <p className="text-muted-foreground text-xs">
                {cachedAt
                  ? `Analyse conservée, générée ${ageLabel(cachedAt)}${
                      cachedPrice !== null
                        ? ` alors que le cours était à ${cachedPrice.toFixed(2)} €`
                        : ""
                    }.`
                  : "Lecture d'indicateurs, pas un conseil d'investissement."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
