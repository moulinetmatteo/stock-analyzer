"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtNum, fmtCap, cn } from "@/lib/utils";

export type FundamentalRow = {
  nom: string;
  ticker: string;
  secteur: string;
  marketCap: number | null;
  netMargin: number | null;
  returnOnEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  recommendation: string | null;
};

/**
 * Chaque filtre affiche ses critères. Un score composite unique serait plus
 * court mais donnerait une fausse impression de précision : mieux vaut que le
 * lecteur voie sur quoi il filtre et puisse en juger.
 */
const SCREENS = [
  {
    id: "tous",
    label: "Tous",
    criteria: "aucun filtre",
    test: () => true,
  },
  {
    id: "qualite",
    label: "Qualité",
    criteria: "marge nette > 10 % · ROE > 15 % · dette/capitaux < 100 %",
    test: (r: FundamentalRow) =>
      (r.netMargin ?? 0) > 0.1 &&
      (r.returnOnEquity ?? 0) > 0.15 &&
      (r.debtToEquity ?? 999) < 100,
  },
  {
    id: "croissance",
    label: "Croissance",
    criteria: "chiffre d'affaires > +10 % · bénéfices > +10 %",
    test: (r: FundamentalRow) =>
      (r.revenueGrowth ?? -1) > 0.1 && (r.earningsGrowth ?? -1) > 0.1,
  },
  {
    id: "valeur",
    label: "Valeur",
    criteria: "PER < 20 · PEG < 1,5",
    test: (r: FundamentalRow) =>
      (r.peRatio ?? 999) < 20 && (r.pegRatio ?? 999) < 1.5,
  },
  {
    id: "rentable-abordable",
    label: "Rentable et abordable",
    criteria: "marge nette > 10 % · ROE > 15 % · PER < 25",
    test: (r: FundamentalRow) =>
      (r.netMargin ?? 0) > 0.1 &&
      (r.returnOnEquity ?? 0) > 0.15 &&
      (r.peRatio ?? 999) < 25,
  },
] as const;

type ScreenId = (typeof SCREENS)[number]["id"];
type SortKey = "nom" | "marketCap" | "netMargin" | "returnOnEquity" | "revenueGrowth" | "peRatio" | "pegRatio";

const RECO_SHORT: Record<string, string> = {
  strong_buy: "Achat fort", buy: "Achat", hold: "Conserver",
  underperform: "Sous-perf.", sell: "Vente",
};

const pct = (v: number | null) =>
  v === null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(1)} %`;

/** Colore selon un seuil, sans prétendre juger l'entreprise. */
function tone(v: number | null, good: number, poor: number, higher = true) {
  if (v === null || Number.isNaN(v)) return "text-muted-foreground";
  const isGood = higher ? v >= good : v <= good;
  const isPoor = higher ? v <= poor : v >= poor;
  if (isGood) return "text-[var(--gain)]";
  if (isPoor) return "text-[var(--loss)]";
  return "";
}

export function FundamentalTable({ rows }: { rows: FundamentalRow[] }) {
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState<ScreenId>("tous");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "marketCap",
    desc: true,
  });

  const active = SCREENS.find((s) => s.id === screen)!;

  const visible = useMemo(() => {
    let out = rows.filter(active.test);

    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(
        (r) =>
          r.nom.toLowerCase().includes(q) ||
          r.ticker.toLowerCase().includes(q) ||
          r.secteur.toLowerCase().includes(q),
      );
    }

    const dir = sort.desc ? -1 : 1;
    return [...out].sort((a, b) => {
      if (sort.key === "nom") return a.nom.localeCompare(b.nom) * dir;
      // Les valeurs absentes finissent toujours en bas, quel que soit le sens.
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
  }, [rows, query, active, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  }

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead className="text-right">
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "hover:text-foreground ml-auto inline-flex items-center gap-1",
          sort.key === k && "text-foreground",
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
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Nom, ticker ou secteur…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-60 pl-8"
          />
        </div>
        <div className="inline-flex flex-wrap rounded-md border p-0.5">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScreen(s.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                screen === s.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-sm">
          {visible.length} sur {rows.length}
        </span>
      </div>

      {/* Les critères du filtre restent visibles : on doit savoir ce qu'on filtre. */}
      <p className="text-muted-foreground text-xs">
        {screen === "tous" ? "Aucun filtre appliqué." : `Critères : ${active.criteria}`}
      </p>

      <div className="surface-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => toggleSort("nom")}
                  className="hover:text-foreground inline-flex items-center gap-1"
                >
                  Nom <ArrowUpDown className="size-3 opacity-50" />
                </button>
              </TableHead>
              <TableHead className="label-eyebrow">Secteur</TableHead>
              <Th k="marketCap">Capi.</Th>
              <Th k="netMargin">Marge nette</Th>
              <Th k="returnOnEquity">ROE</Th>
              <Th k="revenueGrowth">Crois. CA</Th>
              <TableHead className="label-eyebrow text-right">Dette/CP</TableHead>
              <Th k="peRatio">PER</Th>
              <Th k="pegRatio">PEG</Th>
              <TableHead className="label-eyebrow">Consensus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.ticker} className="hover:bg-accent/35">
                <TableCell className="font-medium">
                  <Link
                    href={`/analyse?ticker=${encodeURIComponent(r.ticker)}`}
                    className="hover:underline"
                  >
                    {r.nom}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-32 truncate text-xs">
                  {r.secteur}
                </TableCell>
                <TableCell className="tabular text-right">
                  {fmtCap(r.marketCap)}
                </TableCell>
                <TableCell className={cn("tabular text-right", tone(r.netMargin, 0.1, 0.03))}>
                  {pct(r.netMargin)}
                </TableCell>
                <TableCell className={cn("tabular text-right", tone(r.returnOnEquity, 0.15, 0.05))}>
                  {pct(r.returnOnEquity)}
                </TableCell>
                <TableCell className={cn("tabular text-right", tone(r.revenueGrowth, 0.1, 0))}>
                  {pct(r.revenueGrowth)}
                </TableCell>
                <TableCell className={cn("tabular text-right", tone(r.debtToEquity, 50, 150, false))}>
                  {r.debtToEquity !== null ? fmtNum(r.debtToEquity, 0) : "—"}
                </TableCell>
                <TableCell className={cn("tabular text-right", tone(r.peRatio, 20, 40, false))}>
                  {r.peRatio !== null ? fmtNum(r.peRatio, 1) : "—"}
                </TableCell>
                <TableCell className={cn("tabular text-right", tone(r.pegRatio, 1, 2, false))}>
                  {r.pegRatio !== null ? fmtNum(r.pegRatio, 2) : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {r.recommendation ? (RECO_SHORT[r.recommendation] ?? r.recommendation) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground h-24 text-center">
                  Aucun titre ne passe ces critères. Essaie un filtre moins strict.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs">
        Les ETF sont absents de ce tableau : un fonds n&apos;a ni marge ni
        rentabilité des capitaux. Les couleurs situent un ordre de grandeur — la
        comparaison qui compte est celle avec les concurrents du même secteur.
      </p>
    </div>
  );
}
