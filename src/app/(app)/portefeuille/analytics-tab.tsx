"use client";

import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ReferenceLine, XAxis, YAxis,
} from "recharts";
import {
  ChartContainer, ChartTooltip, type ChartConfig,
} from "@/components/ui/chart";
import { StatCard, StatGrid, SectionTitle } from "@/components/stat-card";
import { fmtEur, fmtPct, fmtNum } from "@/lib/utils";

export type PortfolioPoint = { date: string; value: number };

const SLICE_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
];

const valueConfig = { value: { label: "Valeur", color: "var(--gain)" } } satisfies ChartConfig;
const ddConfig = { dd: { label: "Drawdown", color: "var(--loss)" } } satisfies ChartConfig;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const axisTick = { fontSize: 11 } as const;

export function AnalyticsTab({
  curve,
  invested,
  allocation,
  spyPerf,
}: {
  curve: PortfolioPoint[];
  invested: number;
  allocation: { nom: string; value: number }[];
  spyPerf: number | null;
}) {
  const metrics = useMemo(() => {
    if (curve.length < 3) return null;

    const values = curve.map((c) => c.value);
    const returns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) returns.push(values[i] / values[i - 1] - 1);
    }
    if (!returns.length) return null;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(returns.length - 1, 1);
    const annVol = Math.sqrt(variance) * Math.sqrt(252) * 100;

    const totalRet = (values.at(-1)! / values[0] - 1) * 100;
    const annRet = ((1 + totalRet / 100) ** (252 / values.length) - 1) * 100;
    // Taux sans risque conventionnel à 3 %, comme dans la version Streamlit.
    const sharpe = annVol > 0 ? (annRet - 3) / annVol : 0;

    let peak = values[0];
    const drawdown = values.map((v) => {
      peak = Math.max(peak, v);
      return peak > 0 ? ((v - peak) / peak) * 100 : 0;
    });

    return {
      annVol, totalRet, annRet, sharpe,
      maxDd: Math.min(...drawdown),
      drawdown: curve.map((c, i) => ({ date: c.date, dd: drawdown[i] })),
      alpha: spyPerf !== null ? totalRet - spyPerf : null,
    };
  }, [curve, spyPerf]);

  const totalAlloc = allocation.reduce((a, p) => a + p.value, 0);
  const sorted = [...allocation].sort((a, b) => b.value - a.value);

  if (!curve.length) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        Ajoute des positions pour voir l&apos;analyse du portefeuille.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {metrics && (
        <StatGrid>
          <StatCard
            label="Volatilité annualisée"
            value={`${fmtNum(metrics.annVol, 1)}\u00a0%`}
            hint="dispersion des rendements"
          />
          <StatCard
            label="Ratio de Sharpe"
            value={fmtNum(metrics.sharpe, 2)}
            hint="au-delà de 1 c'est bon, de 2 excellent"
            deltaTone={metrics.sharpe > 1 ? "gain" : metrics.sharpe < 0 ? "loss" : "muted"}
          />
          <StatCard
            label="Drawdown maximum"
            value={`${fmtNum(metrics.maxDd, 1)}\u00a0%`}
            hint="pire baisse depuis un sommet"
          />
          <StatCard
            label="Écart vs S&P 500"
            value={metrics.alpha !== null ? fmtPct(metrics.alpha) : "—"}
            delta={
              spyPerf !== null
                ? `${fmtPct(metrics.totalRet)} contre ${fmtPct(spyPerf)}`
                : undefined
            }
            deltaTone={metrics.alpha === null ? "muted" : metrics.alpha > 0 ? "gain" : "loss"}
          />
        </StatGrid>
      )}

      <section className="surface-card p-5">
        <SectionTitle aside={invested > 0 ? `investi ${fmtEur(invested)}` : undefined}>
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
            {invested > 0 && (
              <ReferenceLine
                y={invested} stroke="var(--warn)" strokeDasharray="4 3" strokeOpacity={0.7}
              />
            )}
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-2 text-xs shadow-xl">
                    <p className="mb-0.5 font-medium">{fmtDate(String(label))}</p>
                    <p className="tabular-nums">{fmtEur(Number(payload[0].value))}</p>
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
                  <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
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
                    style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
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

        {metrics && (
          <section className="surface-card p-5">
            <SectionTitle aside={`pire : ${fmtNum(metrics.maxDd, 1)}\u00a0%`}>
              Drawdown
            </SectionTitle>
            <ChartContainer config={ddConfig} className="aspect-auto h-[280px] w-full">
              <AreaChart data={metrics.drawdown} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
