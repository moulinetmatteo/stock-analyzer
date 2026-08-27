"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { GitCompare, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RsiPill } from "@/components/signal-badge";
import { SectionTitle } from "@/components/stat-card";
import { fmtEur, fmtPct, fmtNum, pnlColor, cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

export type CompareSeries = {
  ticker: string;
  nom: string;
  points: { date: string; norm: number; rsi: number }[];
  priceEur: number;
  perf: number;
  rsi: number | null;
};

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function ComparisonView({
  universe,
  selected,
  series,
}: {
  universe: { nom: string; ticker: string }[];
  selected: string[];
  series: CompareSeries[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setTickers(next: string[]) {
    const p = new URLSearchParams(params.toString());
    if (next.length) p.set("tickers", next.join(","));
    else p.delete("tickers");
    router.push(`${pathname}?${p.toString()}`);
  }

  /** Fusion des séries sur l'axe des dates pour un seul LineChart. */
  const merged = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const s of series) {
      for (const p of s.points) {
        const row = byDate.get(p.date) ?? { date: p.date };
        row[s.ticker] = p.norm;
        byDate.set(p.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [series]);

  const available = universe.filter((u) => !selected.includes(u.ticker));
  const ranked = [...series].sort((a, b) => b.perf - a.perf);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((t, i) => {
          const s = series.find((x) => x.ticker === t);
          return (
            <span
              key={t}
              className="inline-flex items-center gap-2 rounded-full border py-1 pr-1 pl-3 text-sm"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {s?.nom ?? t}
              <button
                onClick={() => setTickers(selected.filter((x) => x !== t))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Retirer ${s?.nom ?? t}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          );
        })}

        {selected.length < 5 && (
          <Select value="" onValueChange={(v) => setTickers([...selected, v])}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Ajouter une action…" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {available.map((u) => (
                <SelectItem key={u.ticker} value={u.ticker}>
                  {u.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {series.length < 2 ? (
        <EmptyState
          icon={GitCompare}
          title="Deux titres minimum"
          description="Ajoute au moins une action de plus pour comparer les performances."
        />
      ) : (
        <>
          <section className="surface-card p-5">
            <SectionTitle aside="base 100 au départ">Performance relative</SectionTitle>
            <div>
              <ChartContainer config={{}} className="aspect-auto h-[320px] w-full">
                <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 11 }}
                    minTickGap={44}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={46}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={6}
                    domain={["auto", "auto"]}
                  />
                  <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="3 3" />
                  <ChartTooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-2 text-xs shadow-xl">
                          <p className="mb-1 font-medium">{fmtDate(String(label))}</p>
                          <ul className="space-y-0.5 tabular-nums">
                            {payload.map((p) => {
                              const key = String(p.dataKey);
                              const s = series.find((x) => x.ticker === key);
                              const v = Number(p.value);
                              return (
                                <li key={key} className="flex justify-between gap-4">
                                  <span style={{ color: p.color }}>{s?.nom ?? key}</span>
                                  <span className={pnlColor(v - 100)}>
                                    {fmtNum(v, 1)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    }}
                  />
                  {series.map((s, i) => (
                    <Line
                      key={s.ticker}
                      dataKey={s.ticker}
                      dot={false}
                      strokeWidth={2}
                      stroke={COLORS[i % COLORS.length]}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </div>
          </section>

          <section className="surface-card p-5">
            <SectionTitle>Récapitulatif</SectionTitle>
            <div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead className="text-right">Prix</TableHead>
                      <TableHead className="text-right">Performance</TableHead>
                      <TableHead className="text-right">RSI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.map((s) => (
                      <TableRow key={s.ticker}>
                        <TableCell className="font-medium">{s.nom}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {s.ticker}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {fmtEur(s.priceEur)}
                        </TableCell>
                        <TableCell
                          className={cn("text-right tabular font-medium", pnlColor(s.perf))}
                        >
                          {fmtPct(s.perf)}
                        </TableCell>
                        <TableCell className="text-right">
                          <RsiPill value={s.rsi} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
