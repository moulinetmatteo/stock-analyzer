"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SignalBadge, RsiPill } from "@/components/signal-badge";
import { fmtEur, fmtPct, pnlColor, cn } from "@/lib/utils";
import type { SignalLevel } from "@/lib/market/indicators";

export type ScreenerRow = {
  nom: string;
  ticker: string;
  price: number;
  change: number;
  rsi: number | null;
  stochK: number | null;
  cross: string;
  signal: SignalLevel;
};

type SortKey = "nom" | "price" | "change" | "rsi" | "signal";

const FILTERS = [
  { id: "tous", label: "Tous" },
  { id: "achat", label: "Signaux achat" },
  { id: "vente", label: "Signaux vente" },
  { id: "survente", label: "RSI < 30" },
  { id: "surachat", label: "RSI > 70" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const SIGNAL_RANK: Record<SignalLevel, number> = {
  "ACHAT fort": 2, "Achat possible": 1, Neutre: 0,
  "Vente possible": -1, "VENTE forte": -2, "—": 0,
};

export function ScreenerTable({ rows }: { rows: ScreenerRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("tous");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "change",
    desc: true,
  });

  const visible = useMemo(() => {
    let out = rows;

    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(
        (r) => r.nom.toLowerCase().includes(q) || r.ticker.toLowerCase().includes(q),
      );
    }

    if (filter === "achat") out = out.filter((r) => SIGNAL_RANK[r.signal] > 0);
    if (filter === "vente") out = out.filter((r) => SIGNAL_RANK[r.signal] < 0);
    if (filter === "survente") out = out.filter((r) => r.rsi !== null && r.rsi < 30);
    if (filter === "surachat") out = out.filter((r) => r.rsi !== null && r.rsi > 70);

    const dir = sort.desc ? -1 : 1;
    return [...out].sort((a, b) => {
      if (sort.key === "nom") return a.nom.localeCompare(b.nom) * dir;
      if (sort.key === "signal") return (SIGNAL_RANK[a.signal] - SIGNAL_RANK[b.signal]) * dir;
      const av = a[sort.key] ?? -Infinity;
      const bv = b[sort.key] ?? -Infinity;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [rows, query, filter, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  }

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <TableHead className={right ? "text-right" : undefined}>
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          sort.key === k ? "text-foreground" : "",
        )}
      >
        {children}
        <ArrowUpDown className="size-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 pl-8"
          />
        </div>
        <div className="inline-flex rounded-md border p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {visible.length} résultat{visible.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <Th k="nom">Nom</Th>
              <TableHead>Ticker</TableHead>
              <Th k="price" right>Prix</Th>
              <Th k="change" right>Var.</Th>
              <Th k="rsi" right>RSI</Th>
              <TableHead className="text-right">Stoch %K</TableHead>
              <TableHead>Cross</TableHead>
              <Th k="signal">Signal</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.ticker}>
                <TableCell className="font-medium">
                  <Link
                    href={`/analyse?ticker=${encodeURIComponent(r.ticker)}`}
                    className="hover:underline"
                  >
                    {r.nom}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.ticker}
                </TableCell>
                <TableCell className="text-right tabular">{fmtEur(r.price)}</TableCell>
                <TableCell className={cn("text-right tabular font-medium", pnlColor(r.change))}>
                  {fmtPct(r.change)}
                </TableCell>
                <TableCell className="text-right"><RsiPill value={r.rsi} /></TableCell>
                <TableCell className="text-right tabular text-muted-foreground">
                  {r.stochK !== null ? r.stochK.toFixed(1) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.cross}</TableCell>
                <TableCell><SignalBadge label={r.signal} /></TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Aucun titre ne correspond à ces critères.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
