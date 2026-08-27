"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtEur, fmtNum, cn } from "@/lib/utils";
import {
  parseCsvAction, convertIsinsAction, importRowsAction, type ParsedRow,
} from "./actions";

export function CsvImport({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [broker, setBroker] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const isinCount = rows?.filter((r) => r.isIsin).length ?? 0;

  function handleFile(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await parseCsvAction(fd);
      if (!res.ok) { toast.error(res.message); setRows(null); return; }
      setRows(res.rows);
      setBroker(res.broker);
      setNote(res.message);
    });
  }

  function convert() {
    if (!rows) return;
    start(async () => {
      const next = await convertIsinsAction(rows);
      setRows([...next]);
      const left = next.filter((r) => r.isIsin).length;
      toast.success(
        left
          ? `Conversion terminée — ${left} code(s) non résolu(s), à corriger à la main.`
          : "Tous les ISINs ont été convertis.",
      );
    });
  }

  function doImport() {
    if (!rows) return;
    start(async () => {
      const res = await importRowsAction(rows);
      if (res.ok) { toast.success(res.message); setRows(null); onDone(); }
      else toast.error(res.message);
    });
  }

  function editTicker(idx: number, value: string) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ticker: value.toUpperCase(), isIsin: false };
      return next;
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <p className="text-sm font-medium">Importer un relevé</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Formats reconnus : Trade Republic, Scalable Capital, Degiro, ou un CSV
            générique avec les colonnes{" "}
            <code className="text-xs">date, ticker, action, quantite, prix</code>.
          </p>
        </div>

        <Input
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {rows && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm">
                Format détecté : <strong>{broker}</strong>
              </span>
              <span className="text-sm text-muted-foreground">{note}</span>
            </div>

            {isinCount > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--chart-5)]/40 bg-[var(--chart-5)]/8 px-3 py-2.5">
                <AlertTriangle className="size-4 shrink-0 text-[var(--chart-5)]" />
                <span className="text-sm">
                  {isinCount} ligne(s) identifient le titre par un code ISIN. Yahoo Finance
                  attend un ticker.
                </span>
                <Button size="sm" variant="outline" disabled={pending} onClick={convert}>
                  <RefreshCw className={cn("size-4", pending && "animate-spin")} />
                  Convertir via OpenFIGI
                </Button>
              </div>
            )}

            <div className="max-h-96 overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="w-44">Ticker</TableHead>
                    <TableHead>Sens</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r.isIsin ? "bg-[var(--chart-5)]/6" : undefined}>
                      <TableCell className="tabular text-muted-foreground">
                        {r.date}
                      </TableCell>
                      <TableCell className="max-w-56 truncate">{r.nom}</TableCell>
                      <TableCell>
                        <Input
                          value={r.ticker}
                          onChange={(e) => editTicker(i, e.target.value)}
                          className={cn(
                            "h-8 font-mono text-xs",
                            r.isIsin && "border-[var(--chart-5)]/60",
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            r.action === "achat"
                              ? "text-[var(--gain)] text-xs font-medium"
                              : "text-[var(--loss)] text-xs font-medium"
                          }
                        >
                          {r.action === "achat" ? "Achat" : "Vente"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {fmtNum(r.quantite, 4)}
                      </TableCell>
                      <TableCell className="text-right tabular">{fmtEur(r.prix)}</TableCell>
                      <TableCell className="text-right tabular">{fmtEur(r.montant)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={pending} onClick={doImport}>
                <Check className="size-4" />
                Importer {rows.length} ligne{rows.length > 1 ? "s" : ""}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setRows(null)}>
                Annuler
              </Button>
              <p className="text-xs text-muted-foreground">
                Les transactions déjà présentes seront ignorées automatiquement.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
