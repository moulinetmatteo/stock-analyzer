"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { StatCard, StatGrid, SectionTitle } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtEur, fmtPct, pnlColor, cn } from "@/lib/utils";

export type PickLine = {
  ticker: string;
  nom: string;
  invested: number;
  value: number;
  benchmarkValue: number | null;
};

export function PicksTab({
  picks,
  funds,
  benchmarkName,
}: {
  picks: PickLine[];
  /** Les fonds, pour situer le poids de la sélection dans l'ensemble. */
  funds: { invested: number; value: number };
  benchmarkName: string;
}) {
  if (!picks.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="Aucune action en direct"
        description={`Tes positions sont toutes des fonds. Dès que tu achèteras un titre choisi par toi, cette page comparera son résultat à ${benchmarkName}.`}
      />
    );
  }

  const invested = picks.reduce((a, p) => a + p.invested, 0);
  const value = picks.reduce((a, p) => a + p.value, 0);
  const complete = picks.every((p) => p.benchmarkValue !== null);
  const benchmark = complete ? picks.reduce((a, p) => a + (p.benchmarkValue ?? 0), 0) : null;
  const edge = benchmark !== null ? value - benchmark : null;
  const winners = picks.filter((p) => p.benchmarkValue !== null && p.value > p.benchmarkValue).length;

  const totalValue = value + funds.value;
  const share = totalValue > 0 ? (value / totalValue) * 100 : 0;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard
          label="Engagé sur tes choix"
          value={fmtEur(invested)}
          hint={`${picks.length} ligne${picks.length > 1 ? "s" : ""} en direct`}
        />
        <StatCard
          label="Valeur actuelle"
          value={fmtEur(value)}
          delta={fmtPct(invested > 0 ? ((value - invested) / invested) * 100 : 0)}
          deltaTone={value >= invested ? "gain" : "loss"}
        />
        <StatCard
          label={`Les mêmes versements sur ${benchmarkName}`}
          value={benchmark !== null ? fmtEur(benchmark) : "—"}
        />
        <StatCard
          label="Écart"
          value={edge !== null ? `${edge >= 0 ? "+" : ""}${fmtEur(edge)}` : "—"}
          hint={
            edge === null
              ? undefined
              : `${winners} pick${winners > 1 ? "s" : ""} sur ${picks.length} devant l'indice`
          }
          deltaTone={edge === null ? "muted" : edge >= 0 ? "gain" : "loss"}
        />
      </StatGrid>

      <section className="surface-card p-5">
        <SectionTitle aside={`${share.toFixed(0)} % de ton portefeuille`}>
          Ligne par ligne
        </SectionTitle>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead className="text-right">Engagé</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead className="text-right">{benchmarkName}</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {picks.map((p) => {
                const diff = p.benchmarkValue !== null ? p.value - p.benchmarkValue : null;
                return (
                  <TableRow key={p.ticker}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/analyse?ticker=${encodeURIComponent(p.ticker)}`}
                        className="hover:underline"
                      >
                        {p.nom}
                      </Link>
                      <span className="text-muted-foreground ml-1.5 font-mono text-[0.7rem]">
                        {p.ticker}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right">{fmtEur(p.invested)}</TableCell>
                    <TableCell className="tabular text-right">{fmtEur(p.value)}</TableCell>
                    <TableCell className="text-muted-foreground tabular text-right">
                      {p.benchmarkValue !== null ? fmtEur(p.benchmarkValue) : "—"}
                    </TableCell>
                    <TableCell className={cn("tabular text-right font-medium", pnlColor(diff))}>
                      {diff !== null ? `${diff >= 0 ? "+" : ""}${fmtEur(diff)}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <p className="text-muted-foreground text-xs">
        Chaque ligne rejoue tes achats, aux mêmes dates et pour les mêmes
        montants, sur {benchmarkName}. C&apos;est la comparaison honnête : elle
        ne récompense pas d&apos;avoir investi au bon moment, seulement
        d&apos;avoir choisi le bon titre. Les fonds indiciels de ton portefeuille
        sont exclus — les comparer à un indice ne dirait rien.
      </p>

      {picks.length < 3 && (
        <p className="text-muted-foreground text-xs">
          Avec {picks.length} ligne{picks.length > 1 ? "s" : ""} et peu de recul,
          ce résultat relève encore largement du hasard. Il devient parlant après
          une dizaine de choix et quelques années.
        </p>
      )}
    </div>
  );
}
