"use client";

import { useActionState, useState, useTransition } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";
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
import { fmtEur, cn } from "@/lib/utils";
import { saveAlertAction, deleteAlertAction, type ActionResult } from "./actions";

export type AlertRow = {
  ticker: string;
  nom: string;
  seuil_bas: number | null;
  seuil_haut: number | null;
  price: number | null;
  status: "achat" | "vente" | "veille";
};

const STATUS_STYLE: Record<AlertRow["status"], string> = {
  achat: "bg-[var(--gain)]/15 text-[var(--gain)] ring-[var(--gain)]/30",
  vente: "bg-[var(--loss)]/15 text-[var(--loss)] ring-[var(--loss)]/30",
  veille: "bg-muted text-muted-foreground ring-border",
};

const STATUS_LABEL: Record<AlertRow["status"], string> = {
  achat: "Seuil d'achat atteint",
  vente: "Seuil de vente atteint",
  veille: "En veille",
};

export function AlertsView({
  rows,
  universe,
  prices,
}: {
  rows: AlertRow[];
  universe: { nom: string; ticker: string }[];
  prices: Record<string, number>;
}) {
  const [open, setOpen] = useState(rows.length === 0);
  const [picked, setPicked] = useState(universe[0]?.ticker ?? "");

  const [, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await saveAlertAction(prev, fd);
      if (res.ok) { toast.success(res.message); setOpen(false); }
      else toast.error(res.message);
      return res;
    },
    null,
  );

  const current = prices[picked];
  const nom = universe.find((u) => u.ticker === picked)?.nom ?? "";
  const active = rows.filter((r) => r.status !== "veille");

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <Card className="border-[var(--gain)]/30">
          <CardContent className="pt-6">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Bell className="size-4" />
              {active.length} alerte{active.length > 1 ? "s" : ""} déclenchée
              {active.length > 1 ? "s" : ""}
            </p>
            <ul className="space-y-2">
              {active.map((r) => (
                <li key={r.ticker} className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {r.nom}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.ticker}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tabular",
                      r.status === "achat" ? "text-[var(--gain)]" : "text-[var(--loss)]",
                    )}
                  >
                    {fmtEur(r.price)}{" "}
                    {r.status === "achat"
                      ? `≤ ${fmtEur(r.seuil_bas)}`
                      : `≥ ${fmtEur(r.seuil_haut)}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" />
          {open ? "Fermer" : "Créer une alerte"}
        </Button>
      </div>

      {open && (
        <Card>
          <CardContent className="pt-6">
            <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Action</Label>
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
                {current !== undefined && (
                  <p className="text-xs tabular text-muted-foreground">
                    Cours actuel {fmtEur(current)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="a-bas">Alerte achat si ≤ (€)</Label>
                <Input
                  id="a-bas"
                  name="seuil_bas"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={current ? (current * 0.95).toFixed(2) : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="a-haut">Alerte vente si ≥ (€)</Label>
                <Input
                  id="a-haut"
                  name="seuil_haut"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={current ? (current * 1.05).toFixed(2) : ""}
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" className="w-full">Enregistrer</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune alerte configurée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Cours</TableHead>
                <TableHead className="text-right">Seuil achat</TableHead>
                <TableHead className="text-right">Seuil vente</TableHead>
                <TableHead>Statut</TableHead>
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
                  <TableCell className="text-right tabular">{fmtEur(r.price)}</TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">
                    {fmtEur(r.seuil_bas)}
                  </TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">
                    {fmtEur(r.seuil_haut)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
                        STATUS_STYLE[r.status],
                      )}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </TableCell>
                  <TableCell><DeleteAlert ticker={r.ticker} nom={r.nom} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DeleteAlert({ ticker, nom }: { ticker: string; nom: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`Supprimer l'alerte ${nom}`}
      onClick={() =>
        start(async () => {
          await deleteAlertAction(ticker);
          toast.success(`Alerte ${nom} supprimée.`);
        })
      }
    >
      <Trash2 className="size-4 text-muted-foreground" />
    </Button>
  );
}
