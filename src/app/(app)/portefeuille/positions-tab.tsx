"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { fmtEur, fmtPct, fmtNum, pnlColor, cn } from "@/lib/utils";
import { savePositionAction, deletePositionAction, type ActionResult } from "./actions";

export type PositionRow = {
  ticker: string;
  nom: string;
  quantite: number;
  prix_achat: number;
  current: number | null;
  invest: number;
  value: number | null;
  pnl: number | null;
  pnlPct: number | null;
};

export function PositionsTab({
  rows,
  totalValue,
  totalInvest,
  unpriced,
  universe,
}: {
  rows: PositionRow[];
  totalValue: number;
  totalInvest: number;
  unpriced: string[];
  universe: { nom: string; ticker: string }[];
}) {
  const [open, setOpen] = useState(rows.length === 0);
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await savePositionAction(prev, fd);
      if (res.ok) { toast.success(res.message); setOpen(false); }
      else toast.error(res.message);
      return res;
    },
    null,
  );

  const pnl = totalValue - totalInvest;
  const pnlPct = totalInvest ? (pnl / totalInvest) * 100 : 0;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard label="Valeur totale" value={fmtEur(totalValue)} />
        <StatCard label="Investi" value={fmtEur(totalInvest)} />
        <StatCard
          label="Plus/moins-value"
          value={fmtEur(pnl)}
          delta={fmtPct(pnlPct)}
          deltaTone={pnl > 0 ? "gain" : pnl < 0 ? "loss" : "muted"}
        />
        <StatCard
          label="Positions"
          value={String(rows.length)}
          hint={unpriced.length ? `dont ${unpriced.length} sans cours` : undefined}
        />
      </StatGrid>

      {unpriced.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-[var(--chart-5)]/40 bg-[var(--chart-5)]/8 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--chart-5)]" />
          <div className="text-sm">
            <p className="font-medium">
              {unpriced.length} position{unpriced.length > 1 ? "s" : ""} sans cours —
              exclue{unpriced.length > 1 ? "s" : ""} des totaux ci-dessus.
            </p>
            <p className="mt-1 text-muted-foreground">
              Yahoo Finance ne reconnaît pas{" "}
              {unpriced.map((t, i) => (
                <span key={t}>
                  {i > 0 && ", "}
                  <code className="font-mono text-xs">{t}</code>
                </span>
              ))}
              . Ce sont des codes ISIN : remplace-les par le ticker Yahoo
              correspondant via « Ajouter / modifier une position ».
            </p>
          </div>
        </div>
      )}

      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" />
          {open ? "Fermer" : "Ajouter / modifier une position"}
        </Button>
      </div>

      {open && (
        <Card>
          <CardContent className="pt-6">
            <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2 lg:col-span-2">
                <Label>Action</Label>
                <TickerField universe={universe} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-qty">Quantité</Label>
                <Input id="p-qty" name="quantite" type="number" step="0.0001" min="0.0001" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-price">Prix de revient (€)</Label>
                <Input id="p-price" name="prix_achat" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">Enregistrer</Button>
              </div>
            </form>
            {state && !state.ok && (
              <p className="mt-3 text-sm text-destructive">{state.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune position. Ajoutes-en une ci-dessus ou importe un CSV depuis
          l&apos;onglet Transactions.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">PRU</TableHead>
                <TableHead className="text-right">Cours</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead className="text-right">+/- value</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.ticker}>
                  <TableCell className="font-medium">{r.nom}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.ticker}
                  </TableCell>
                  <TableCell className="text-right tabular">{fmtNum(r.quantite, 4)}</TableCell>
                  <TableCell className="text-right tabular">{fmtEur(r.prix_achat)}</TableCell>
                  <TableCell className="text-right tabular">{fmtEur(r.current)}</TableCell>
                  <TableCell className="text-right tabular">{fmtEur(r.value)}</TableCell>
                  <TableCell className={cn("text-right tabular font-medium", pnlColor(r.pnl))}>
                    {fmtEur(r.pnl)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular font-medium", pnlColor(r.pnlPct))}>
                    {fmtPct(r.pnlPct)}
                  </TableCell>
                  <TableCell>
                    <DeleteButton ticker={r.ticker} nom={r.nom} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TickerField({ universe }: { universe: { nom: string; ticker: string }[] }) {
  const [mode, setMode] = useState<"liste" | "libre">("liste");
  const [picked, setPicked] = useState(universe[0]?.ticker ?? "");
  const nom = universe.find((u) => u.ticker === picked)?.nom ?? "";

  if (mode === "libre") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input name="ticker" placeholder="Ticker (ex: STLAM.MI)" required />
          <Input name="nom" placeholder="Nom affiché" />
        </div>
        <button
          type="button"
          onClick={() => setMode("liste")}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Choisir dans la liste
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
      <button
        type="button"
        onClick={() => setMode("libre")}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Saisir un ticker libre →
      </button>
    </div>
  );
}

function DeleteButton({ ticker, nom }: { ticker: string; nom: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`Supprimer ${nom}`}
      onClick={() =>
        start(async () => {
          await deletePositionAction(ticker);
          toast.success(`${nom} supprimé.`);
        })
      }
    >
      <Trash2 className="size-4 text-muted-foreground" />
    </Button>
  );
}
