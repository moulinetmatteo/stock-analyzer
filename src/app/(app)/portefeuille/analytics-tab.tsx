"use client";

import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ReferenceLine, XAxis, YAxis,
} from "recharts";
import {
  ChartContainer, ChartTooltip, type ChartConfig,
} from "@/components/ui/chart";
import { StatCard, StatGrid, SectionTitle } from "@/components/stat-card";
import { fmtEur, fmtPct, fmtNum } from "@/lib/utils";
import { ChartLine } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export type PortfolioPoint = { date: string; value: number; invested: number };

/**
 * Rampe générée plutôt que cinq couleurs qui se répètent : au-delà de cinq
 * lignes, deux positions finissaient sinon avec la même teinte.
 */
function sliceColors(n: number): string[] {
  if (n <= 5) {
    return ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
      .slice(0, n);
  }
  // Parcours régulier de la roue depuis le violet de la marque.
  return Array.from({ length: n }, (_, i) => {
    const hue = (278 + (360 / n) * i) % 360;
    return `oklch(0.72 0.15 ${hue.toFixed(1)})`;
  });
}

const valueConfig = { value: { label: "Valeur", color: "var(--gain)" } } satisfies ChartConfig;
const ddConfig = { dd: { label: "Drawdown", color: "var(--loss)" } } satisfies ChartConfig;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const axisTick = { fontSize: 11 } as const;

export function AnalyticsTab({
  curve,
  twr,
  irr,
  benchmark,
  allocation,
  volatility,
  sharpe,
  maxDrawdown,
  drawdown,
}: {
  curve: PortfolioPoint[];
  /** Performance des titres, hors effet du calendrier des versements. */
  twr: number | null;
  /** Ce que l'argent a rapporté, en tenant compte des dates de versement. */
  irr: number | null;
  /** Mêmes versements rejoués sur le S&P 500. */
  benchmark: { value: number; invested: number } | null;
  allocation: { nom: string; value: number }[];
  volatility: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  drawdown: { date: string; dd: number }[];
}) {


  const finalValue = curve.at(-1)?.value ?? 0;
  const finalInvested = curve.at(-1)?.invested ?? 0;
  const edge = benchmark ? finalValue - benchmark.value : 0;
  const totalAlloc = allocation.reduce((a, p) => a + p.value, 0);
  const sorted = [...allocation].sort((a, b) => b.value - a.value);
  const palette = sliceColors(sorted.length);

  if (!curve.length) {
    return (
      <EmptyState
        icon={ChartLine}
        title="Rien à analyser"
        description="Les métriques de risque se calculent sur l'historique de tes positions — ajoutes-en d'abord."
      />
    );
  }

  return (
    <div className="space-y-5">
      <StatGrid>
          <StatCard
            label="Performance des titres"
            value={twr !== null ? fmtPct(twr) : "—"}
            hint="hors effet du calendrier des versements"
            deltaTone={twr === null ? "muted" : twr > 0 ? "gain" : "loss"}
          />
          <StatCard
            label="Volatilité annualisée"
            value={volatility !== null ? `${fmtNum(volatility, 1)}\u00a0%` : "—"}
            hint="dispersion des rendements"
          />
          <StatCard
            label="Ratio de Sharpe"
            value={sharpe !== null ? fmtNum(sharpe, 2) : "—"}
            hint="au-delà de 1 c'est bon, de 2 excellent"
            deltaTone={sharpe === null ? "muted" : sharpe > 1 ? "gain" : sharpe < 0 ? "loss" : "muted"}
          />
          <StatCard
            label="Drawdown maximum"
            value={maxDrawdown !== null ? `${fmtNum(maxDrawdown, 1)}\u00a0%` : "—"}
            hint="pire baisse depuis un sommet"
          />
          <StatCard
            label="Rendement annualisé"
            value={irr !== null ? fmtPct(irr) : "—"}
            hint="ce que ton argent a rapporté, dates de versement comprises"
            deltaTone={irr === null ? "muted" : irr > 0 ? "gain" : "loss"}
          />
        </StatGrid>

      {benchmark && (
        <section className="surface-card p-5">
          <SectionTitle aside="mêmes versements, mêmes dates">
            Et si tu avais tout mis sur le S&P 500 ?
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="label-eyebrow">Ton portefeuille</p>
              <p className="metric mt-1.5">{fmtEur(finalValue)}</p>
            </div>
            <div>
              <p className="label-eyebrow">Le S&P 500</p>
              <p className="metric mt-1.5">{fmtEur(benchmark.value)}</p>
            </div>
            <div>
              <p className="label-eyebrow">Écart</p>
              <p
                className="metric mt-1.5"
                style={{ color: edge >= 0 ? "var(--gain)" : "var(--loss)" }}
              >
                {edge >= 0 ? "+" : ""}{fmtEur(edge)}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Pour {fmtEur(benchmark.invested)} versés au même rythme.{" "}
            {edge >= 0
              ? "Tes choix ont fait mieux que l'indice sur cette période."
              : "L'indice a fait mieux que tes choix sur cette période."}
          </p>
        </section>
      )}

      <section className="surface-card p-5">
        <SectionTitle aside={finalInvested > 0 ? `versé ${fmtEur(finalInvested)}` : undefined}>
          Évolution de la valeur
        </SectionTitle>
        <ChartContainer config={valueConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date" tickFormatter={fmtDate} tick={axisTick}
              tickLine={false} axisLine={false} tickMargin={8} minTickGap={44}
            />
            <YAxis
              tick={axisTick} tickLine={false} axisLine={false} tickMargin={6} width={58}
              tickFormatter={(v: number) => fmtNum(v, 0)}
              domain={["auto", "auto"]}
            />
            {/* Le versé cumulé progresse : une ligne droite serait fausse. */}
            <Area
              dataKey="invested" type="stepAfter" stroke="var(--warn)"
              strokeWidth={1.5} strokeDasharray="4 3" fill="none"
              isAnimationActive={false}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-2 text-xs shadow-xl">
                    <p className="mb-1 font-medium">{fmtDate(String(label))}</p>
                    <p className="tabular-nums">
                      Valeur {fmtEur(Number(payload.find((x) => x.dataKey === "value")?.value ?? 0))}
                    </p>
                    <p className="text-muted-foreground tabular-nums">
                      Versé {fmtEur(Number(payload.find((x) => x.dataKey === "invested")?.value ?? 0))}
                    </p>
                  </div>
                ) : null
              }
            />
            <Area
              dataKey="value" type="monotone" stroke="var(--color-value)"
              strokeWidth={2} fill="url(#fillValue)" isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-5">
          <SectionTitle aside={`${allocation.length} ligne(s)`}>Répartition</SectionTitle>
          <ChartContainer
            config={{}}
            className="mx-auto aspect-square h-[210px]"
          >
            <PieChart>
              <ChartTooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-2 text-xs shadow-xl">
                      <p className="font-medium">{payload[0].name}</p>
                      <p className="tabular-nums">
                        {fmtEur(Number(payload[0].value))} ·{" "}
                        {fmtNum((Number(payload[0].value) / totalAlloc) * 100, 1)}&nbsp;%
                      </p>
                    </div>
                  ) : null
                }
              />
              <Pie
                data={sorted} dataKey="value" nameKey="nom"
                innerRadius={58} outerRadius={92} paddingAngle={2} strokeWidth={0}
                isAnimationActive={false}
              >
                {sorted.map((_, i) => (
                  <Cell key={i} fill={palette[i]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <ul className="mt-4 space-y-1.5">
            {sorted.map((a, i) => (
              <li key={a.nom} className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: palette[i] }}
                  />
                  <span className="truncate">{a.nom}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-muted-foreground tabular text-xs">{fmtEur(a.value)}</span>
                  <span className="tabular w-14 shrink-0 text-right font-medium whitespace-nowrap">
                    {fmtNum((a.value / totalAlloc) * 100, 1)}&nbsp;%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {drawdown.length > 0 && (
          <section className="surface-card p-5">
            <SectionTitle aside={maxDrawdown !== null ? `pire : ${fmtNum(maxDrawdown, 1)}\u00a0%` : undefined}>
              Drawdown
            </SectionTitle>
            <ChartContainer config={ddConfig} className="aspect-auto h-[280px] w-full">
              <AreaChart data={drawdown} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="fillDd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-dd)" stopOpacity={0.05} />
                    <stop offset="95%" stopColor="var(--color-dd)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date" tickFormatter={fmtDate} tick={axisTick}
                  tickLine={false} axisLine={false} tickMargin={8} minTickGap={44}
                />
                <YAxis
                  tick={axisTick} tickLine={false} axisLine={false} tickMargin={6} width={46}
                  tickFormatter={(v: number) => `${v.toFixed(0)}\u00a0%`}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-2 text-xs shadow-xl">
                        <p className="mb-0.5 font-medium">{fmtDate(String(label))}</p>
                        <p className="tabular-nums" style={{ color: "var(--loss)" }}>
                          {fmtNum(Number(payload[0].value), 2)}&nbsp;%
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Area
                  dataKey="dd" type="monotone" stroke="var(--color-dd)"
                  strokeWidth={1.5} fill="url(#fillDd)" isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </section>
        )}
      </div>
    </div>
  );
}
