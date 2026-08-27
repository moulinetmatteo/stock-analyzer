"use client";

import { useActionState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/stat-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomTicker } from "@/lib/data";
import {
  addCustomTickerAction, deleteCustomTickerAction, type ActionResult,
} from "./actions";

export function WatchlistCard({ items }: { items: CustomTicker[] }) {
  const [, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await addCustomTickerAction(prev, fd);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      return res;
    },
    null,
  );

  return (
    <section className="surface-card p-5">
      <SectionTitle aside={items.length ? `${items.length} titre(s)` : undefined}>
        Watchlist personnalisée
      </SectionTitle>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ajoute les titres absents de la liste par défaut. Ils apparaîtront dans le
          screener, l&apos;analyse et les alertes.
        </p>

        <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="w-nom">Nom affiché</Label>
            <Input id="w-nom" name="nom" placeholder="ex : Stellantis" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-ticker">Ticker Yahoo Finance</Label>
            <Input
              id="w-ticker"
              name="ticker"
              placeholder="ex : STLAM.MI"
              className="font-mono"
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit"><Plus className="size-4" />Ajouter</Button>
          </div>
        </form>

        {items.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {items.map((c) => (
              <li key={c.nom} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">
                  <strong className="font-medium">{c.nom}</strong>{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.ticker}
                  </span>
                </span>
                <RemoveButton nom={c.nom} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RemoveButton({ nom }: { nom: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`Retirer ${nom}`}
      onClick={() =>
        start(async () => {
          await deleteCustomTickerAction(nom);
          toast.success(`${nom} retiré de la watchlist.`);
        })
      }
    >
      <Trash2 className="size-4 text-muted-foreground" />
    </Button>
  );
}
