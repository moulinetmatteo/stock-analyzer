"use client";

import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/stat-card";
import { fmtEur, fmtPct, fmtNum } from "@/lib/utils";

export type PortfolioPoint = { date: string; value: number };

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

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
      return { value: peak > 0 ? ((v - peak) / peak) * 100 : 0 };
    });
    const maxDd = Math.min(...drawdown.map((d) => d.value));

    return {
      annVol, totalRet, annRet, sharpe, maxDd,
      drawdown: curve.map((c, i) => ({ date: c.date, dd: drawdown[i].value })),
      alpha: spyPerf !== null ? totalRet - spyPerf : null,
    };
  }, [curve, spyPerf]);

  const totalAlloc = allocation.reduce((a, p) => a + p.value, 0);

  if (!curve.length) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
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
            value={`${fmtNum(metrics.annVol, 1)}%`}
            hint="dispersion des rendements"
          />
          <StatCard
            label="Ratio de Sharpe"
            value={fmtNum(metrics.sharpe, 2)}
            hint="> 1 bon · > 2 excellent"
            deltaTone={metrics.sharpe > 1 ? "gain" : metrics.sharpe < 0 ? "loss" : "muted"}
          />
          <StatCard
            label="Drawdown maximum"
            value={`${fmtNum(metrics.maxDd, 1)}%`}
            hint="pire baisse depuis un sommet"
          />
          <StatCard
            label="vs S&P 500"
            value={metrics.alpha !== null ? fmtPct(metrics.alpha) : "—"}
            delta={
              spyPerf !== null
                ? `Portef. ${fmtPct(metrics.totalRet)} · SPY ${fmtPct(spyPerf)}`
                : undefined
            }
            deltaTone={
              metrics.alpha === null ? "muted" : metrics.alpha > 0 ? "gain" : "loss"
            }
          />
        </StatGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution de la valeur</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gain)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--gain)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                minTickGap={40}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v: number) => fmtNum(v, 0)}
                width={64}
                axisLine={false}
                tickLine={false}
              />
              {invested > 0 && (
                <ReferenceLine
                  y={invested}
                  stroke="var(--chart-5)"
                  strokeDasharray="4 3"
                  label={{
                    value: "Investi",
                    position: "insideTopRight",
                    fill: "var(--chart-5)",
                    fontSize: 11,
                  }}
                />
              )}
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="font-medium">{fmtDate(String(label))}</p>
                      <p className="tabular">{fmtEur(Number(payload[0].value))}</p>
                    </div>
                  ) : null
                }
              />
              <Area
                dataKey="value"
                stroke="var(--gain)"
                strokeWidth={2}
                fill="url(#pv)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="nom"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {allocation.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-medium">{payload[0].name}</p>
                        <p className="tabular">
                          {fmtEur(Number(payload[0].value))} ·{" "}
                          {fmtNum((Number(payload[0].value) / totalAlloc) * 100, 1)}%
                        </p>
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-3 space-y-1.5">
              {allocation
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((a, i) => (
                  <li key={a.nom} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      {a.nom}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {fmtNum((a.value / totalAlloc) * 100, 1)}%
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drawdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={metrics.drawdown}
                  margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                >
                  <defs>
                    <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--loss)" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    minTickGap={40}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    width={48}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <p className="font-medium">{fmtDate(String(label))}</p>
                          <p className="tabular text-[var(--loss)]">
                            {fmtNum(Number(payload[0].value), 2)}%
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    dataKey="dd"
                    stroke="var(--loss)"
                    strokeWidth={1.5}
                    fill="url(#dd)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
