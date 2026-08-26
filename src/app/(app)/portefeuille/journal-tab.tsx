"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtEur, fmtPct, pnlColor, cn } from "@/lib/utils";
import type { JournalEntry } from "@/lib/data";
import { saveJournalAction, type ActionResult } from "./actions";

type Pos = { ticker: string; nom: string; current: number | null };

export function JournalTab({
  positions,
  entries,
}: {
  positions: Pos[];
  entries: JournalEntry[];
}) {
  if (!positions.length) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Le journal se remplit position par position — ajoute d&apos;abord une ligne au
        portefeuille.
      </p>
    );
  }

  const byTicker = new Map(entries.map((e) => [e.ticker, e]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Consigne ta thèse d&apos;investissement, un objectif de prix et la date à
        laquelle tu veux réexaminer la position.
      </p>
      {positions.map((p) => (
        <JournalCard key={p.ticker} pos={p} entry={byTicker.get(p.ticker)} />
      ))}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Enregistrer"}
    </Button>
  );
}

function JournalCard({ pos, entry }: { pos: Pos; entry?: JournalEntry }) {
  const [, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await saveJournalAction(prev, fd);
      if (res.ok) toast.success(`${pos.nom} — journal enregistré.`);
      else toast.error(res.message);
      return res;
    },
    null,
  );

  const target = entry?.target_price ?? null;
  const upside =
    target && pos.current ? ((target - pos.current) / pos.current) * 100 : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <input type="hidden" name="ticker" value={pos.ticker} />

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">
              {pos.nom}{" "}
              <span className="font-mono text-xs text-muted-foreground">{pos.ticker}</span>
            </h3>
            <span className="tabular text-sm text-muted-foreground">
              Cours actuel {fmtEur(pos.current)}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor={`note-${pos.ticker}`}>Thèse d&apos;investissement</Label>
              <textarea
                id={`note-${pos.ticker}`}
                name="note"
                defaultValue={entry?.note ?? ""}
                rows={3}
                placeholder="Pourquoi cette position, ce qui la validerait ou l'invaliderait…"
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            </div>

            <div className="flex gap-4 lg:w-72 lg:flex-col lg:gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`target-${pos.ticker}`}>Prix cible (€)</Label>
                <Input
                  id={`target-${pos.ticker}`}
                  name="target_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={target ?? ""}
                />
                {upside !== null && (
                  <p className={cn("text-xs tabular", pnlColor(upside))}>
                    Potentiel {fmtPct(upside)}
                  </p>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor={`rev-${pos.ticker}`}>Date de revue</Label>
                <Input
                  id={`rev-${pos.ticker}`}
                  name="review_date"
                  type="date"
                  defaultValue={entry?.review_date ?? ""}
                />
              </div>
            </div>
          </div>

          <SaveButton />
        </form>
      </CardContent>
    </Card>
  );
}
