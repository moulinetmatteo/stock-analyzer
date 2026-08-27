"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eye, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RsiPill } from "@/components/signal-badge";
import { EmptyState } from "@/components/empty-state";
import { fmtEur, fmtPct, pnlColor, cn } from "@/lib/utils";
import type { Candidate, CandidateStatus } from "@/lib/data";
import {
  saveCandidateAction, setStatusAction, deleteCandidateAction, type ActionResult,
} from "./actions";

export type CandidateRow = Candidate & {
  price: number | null;
  rsi: number | null;
  sinceAdded: number | null;
  toTarget: number | null;
  held: boolean;
};

const CONVICTION = ["", "tiède", "intéressé", "convaincu"];

const STATUT_STYLE: Record<CandidateStatus, string> = {
  surveille: "bg-muted text-muted-foreground",
  achete: "bg-[var(--gain-soft)] text-[var(--gain)]",
  abandonne: "bg-muted/60 text-muted-foreground line-through",
};

const STATUT_LABEL: Record<CandidateStatus, string> = {
  surveille: "Sous surveillance",
  achete: "Acheté",
  abandonne: "Abandonné",
};

export function CandidatesView({
  rows,
  universe,
}: {
  rows: CandidateRow[];
  universe: { nom: string; ticker: string }[];
}) {
  const [open, setOpen] = useState(rows.length === 0);
  const [picked, setPicked] = useState(universe[0]?.ticker ?? "");
  const [showArchived, setShowArchived] = useState(false);

  const [, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await saveCandidateAction(prev, fd);
      if (res.ok) { toast.success(res.message); setOpen(false); }
      else toast.error(res.message);
      return res;
    },
    null,
  );

  const nom = universe.find((u) => u.ticker === picked)?.nom ?? "";
  const watching = rows.filter((r) => r.statut === "surveille");
  const archived = rows.filter((r) => r.statut !== "surveille");
  const visible = showArchived ? archived : watching;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" />
          {open ? "Fermer" : "Suivre un titre"}
        </Button>
        {archived.length > 0 && (
          <Button
            variant={showArchived ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Voir la surveillance" : `Voir les archivés (${archived.length})`}
          </Button>
        )}
      </div>

      {open && (
        <div className="surface-card p-5">
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-2">
                <Label>Titre</Label>
                <Select value={picked} onValueChange={setPicked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {universe.map((u) => (
                      <SelectItem key={u.ticker} value={u.ticker}>{u.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="ticker" value={picked} />
                <input type="hidden" name="nom" value={nom} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-cible">Prix d&apos;achat visé (€)</Label>
                <Input id="c-cible" name="prix_cible" type="number" step="0.01" min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-conv">Conviction</Label>
                <select
                  id="c-conv"
                  name="conviction"
                  defaultValue="2"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="1">Tiède</option>
                  <option value="2">Intéressé</option>
                  <option value="3">Convaincu</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-these">Pourquoi ce titre ?</Label>
              <textarea
                id="c-these"
                name="these"
                rows={3}
                placeholder="Ce que tu as remarqué, ce que tu attends, ce qui te ferait renoncer…"
                className="placeholder:text-muted-foreground focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
              />
              <p className="text-muted-foreground text-xs">
                Écris-la maintenant, avant d&apos;acheter. Dans six mois, c&apos;est
                elle qui te dira si tu avais raison pour les bonnes raisons.
              </p>
            </div>

            <Button type="submit" size="sm">Enregistrer</Button>
          </form>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={Eye}
          title={showArchived ? "Aucun titre archivé" : "Aucun candidat"}
          description={
            showArchived
              ? "Les titres achetés ou abandonnés apparaîtront ici."
              : "Ajoute un titre que tu surveilles, avec la raison qui t'a fait le remarquer."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <CandidateCard key={r.ticker} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ row: r }: { row: CandidateRow }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState<CandidateStatus | null>(null);

  function close(statut: CandidateStatus) {
    start(async () => {
      const res = await setStatusAction(r.ticker, statut, note);
      if (res.ok) { toast.success(res.message); setClosing(null); }
      else toast.error(res.message);
    });
  }

  return (
    <div className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-medium">
            <Link
              href={`/analyse?ticker=${encodeURIComponent(r.ticker)}`}
              className="hover:underline"
            >
              {r.nom}
            </Link>
            <span className="text-muted-foreground font-mono text-xs">{r.ticker}</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[0.65rem] font-medium", STATUT_STYLE[r.statut])}>
              {STATUT_LABEL[r.statut]}
            </span>
            {r.held && (
              <span className="bg-[var(--gain-soft)] text-[var(--gain)] rounded px-1.5 py-0.5 text-[0.65rem] font-medium">
                en portefeuille
              </span>
            )}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Suivi depuis le {new Date(r.created_at).toLocaleDateString("fr-FR")} ·
            conviction {CONVICTION[r.conviction] ?? "—"}
          </p>
        </div>

        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="label-eyebrow">Cours</p>
            <p className="tabular mt-0.5 font-medium">{fmtEur(r.price)}</p>
          </div>
          {r.sinceAdded !== null && (
            <div>
              <p className="label-eyebrow">Depuis l&apos;ajout</p>
              <p className={cn("tabular mt-0.5 font-medium", pnlColor(r.sinceAdded))}>
                {fmtPct(r.sinceAdded)}
              </p>
            </div>
          )}
          {r.prix_cible !== null && (
            <div>
              <p className="label-eyebrow">Cible</p>
              <p className="tabular mt-0.5 font-medium">{fmtEur(r.prix_cible)}</p>
              {r.toTarget !== null && (
                <p className="text-muted-foreground tabular text-[0.7rem]">
                  {r.toTarget <= 0 ? "atteinte" : `${fmtPct(r.toTarget)} au-dessus`}
                </p>
              )}
            </div>
          )}
          <div>
            <p className="label-eyebrow">RSI</p>
            <p className="mt-0.5"><RsiPill value={r.rsi} /></p>
          </div>
        </div>
      </div>

      {r.these && (
        <p className="mt-4 border-t pt-3 text-sm whitespace-pre-wrap">{r.these}</p>
      )}

      {r.note_sortie && (
        <p className="text-muted-foreground mt-2 text-sm italic">
          Épilogue : {r.note_sortie}
        </p>
      )}

      {r.statut === "surveille" && (
        <div className="mt-4 border-t pt-3">
          {closing ? (
            <div className="space-y-2">
              <Label htmlFor={`note-${r.ticker}`}>
                {closing === "achete" ? "Pourquoi tu achètes ?" : "Pourquoi tu renonces ?"}
              </Label>
              <Input
                id={`note-${r.ticker}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Une phrase suffit — c'est elle que tu reliras."
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={pending} onClick={() => close(closing)}>
                  Confirmer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setClosing("achete")}>
                <Check className="size-3.5" />
                J&apos;ai acheté
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setClosing("abandonne")}>
                <X className="size-3.5" />
                J&apos;abandonne
              </Button>
              <DeleteButton ticker={r.ticker} nom={r.nom} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeleteButton({ ticker, nom }: { ticker: string; nom: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      className="text-muted-foreground ml-auto"
      onClick={() =>
        start(async () => {
          await deleteCandidateAction(ticker);
          toast.success(`${nom} retiré des candidats.`);
        })
      }
    >
      <Trash2 className="size-3.5" />
      Retirer
    </Button>
  );
}
