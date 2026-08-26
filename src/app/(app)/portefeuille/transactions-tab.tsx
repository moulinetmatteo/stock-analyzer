"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
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
import { fmtEur, fmtNum, cn } from "@/lib/utils";
import type { Transaction } from "@/lib/data";
import { addTransactionAction, deleteTransactionAction, type ActionResult } from "./actions";
import { CsvImport } from "./csv-import";

export function TransactionsTab({
  transactions,
  universe,
}: {
  transactions: Transaction[];
  universe: { nom: string; ticker: string }[];
}) {
  const [panel, setPanel] = useState<"none" | "manuel" | "csv">("none");

  const [, action] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const res = await addTransactionAction(prev, fd);
      if (res.ok) { toast.success(res.message); setPanel("none"); }
      else toast.error(res.message);
      return res;
    },
    null,
  );

  const [picked, setPicked] = useState(universe[0]?.ticker ?? "");
  const nom = universe.find((u) => u.ticker === picked)?.nom ?? "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={panel === "manuel" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setPanel((p) => (p === "manuel" ? "none" : "manuel"))}
        >
          <Plus className="size-4" />
          Saisir une transaction
        </Button>
        <Button
          variant={panel === "csv" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setPanel((p) => (p === "csv" ? "none" : "csv"))}
        >
          <Upload className="size-4" />
          Importer un CSV
        </Button>
      </div>

      {panel === "manuel" && (
        <Card>
          <CardContent className="pt-6">
            <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-2 lg:col-span-2">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-sens">Sens</Label>
                <select
                  id="t-sens"
                  name="action"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  defaultValue="achat"
                >
                  <option value="achat">Achat</option>
                  <option value="vente">Vente</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-date">Date</Label>
                <Input
                  id="t-date"
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-qty">Quantité</Label>
                <Input id="t-qty" name="quantite" type="number" step="0.0001" min="0.0001" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-price">Prix (€)</Label>
                <Input id="t-price" name="prix" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="flex items-end lg:col-span-6">
                <Button type="submit">Enregistrer la transaction</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {panel === "csv" && <CsvImport onDone={() => setPanel("none")} />}

      {transactions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune transaction enregistrée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Sens</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="tabular text-muted-foreground">
                    {new Date(t.date).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-medium">{t.nom}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.ticker}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        t.action === "achat"
                          ? "bg-[var(--gain)]/12 text-[var(--gain)] ring-[var(--gain)]/25"
                          : "bg-[var(--loss)]/12 text-[var(--loss)] ring-[var(--loss)]/25",
                      )}
                    >
                      {t.action === "achat" ? "Achat" : "Vente"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular">{fmtNum(t.quantite, 4)}</TableCell>
                  <TableCell className="text-right tabular">{fmtEur(t.prix)}</TableCell>
                  <TableCell className="text-right tabular">{fmtEur(t.montant)}</TableCell>
                  <TableCell><DeleteTx id={t.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DeleteTx({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label="Supprimer la transaction"
      onClick={() =>
        start(async () => {
          await deleteTransactionAction(id);
          toast.success("Transaction supprimée.");
        })
      }
    >
      <Trash2 className="size-4 text-muted-foreground" />
    </Button>
  );
}
