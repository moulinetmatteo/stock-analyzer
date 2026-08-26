"use client";

import {
  CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtEur, fmtPct, fmtNum, cn } from "@/lib/utils";
import type { BacktestResult } from "@/lib/market/backtest";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function BacktestResults({
  result,
  label,
  capital,
}: {
  result: BacktestResult;
  label: string;
  capital: number;
}) {
  const edge = result.totalReturn - result.buyHoldReturn;

  const buyMarks = result.trades
    .filter((t) => t.action === "achat")
    .map((t) => ({
      date: t.date,
      value: result.equity.find((e) => e.date === t.date)?.strategy ?? 0,
    }));
  const sellMarks = result.trades
    .filter((t) => t.action === "vente")
    .map((t) => ({
      date: t.date,
      value: result.equity.find((e) => e.date === t.date)?.strategy ?? 0,
    }));

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard
          label="Valeur finale"
          value={fmtEur(result.finalValue)}
          delta={fmtPct(result.totalReturn)}
          deltaTone={result.totalReturn > 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Buy & hold"
          value={fmtEur(capital * (1 + result.buyHoldReturn / 100))}
          delta={fmtPct(result.buyHoldReturn)}
          deltaTone={result.buyHoldReturn > 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Écart vs buy & hold"
          value={fmtPct(edge)}
          delta={edge > 0 ? "la stratégie fait mieux" : "le buy & hold fait mieux"}
          deltaTone={edge > 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Trades"
          value={String(result.tradeCount)}
          hint={
            result.winRate !== null
              ? `${fmtNum(result.winRate, 0)}% d'aller-retours gagnants`
              : "aucun aller-retour clôturé"
          }
        />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Courbe de capital — {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart
              data={result.equity}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
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
                width={62}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={({ active, payload, label: l }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="mb-1 font-medium">{fmtDate(String(l))}</p>
                      <ul className="space-y-0.5 tabular">
                        {payload.map((p) => (
                          <li key={String(p.dataKey)} className="flex justify-between gap-4">
                            <span style={{ color: p.color }}>
                              {p.dataKey === "strategy" ? "Stratégie" : "Buy & hold"}
                            </span>
                            <span>{fmtEur(Number(p.value))}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                }
              />
              <Line
                dataKey="strategy"
                dot={false}
                strokeWidth={2}
                stroke="var(--gain)"
                isAnimationActive={false}
              />
              <Line
                dataKey="buyHold"
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                stroke="var(--muted-foreground)"
                isAnimationActive={false}
              />
              <Scatter
                data={buyMarks}
                dataKey="value"
                fill="var(--gain)"
                shape="triangle"
                isAnimationActive={false}
              />
              <Scatter
                data={sellMarks}
                dataKey="value"
                fill="var(--loss)"
                shape="diamond"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <Legend color="var(--gain)" label="Stratégie" />
            <Legend color="var(--muted-foreground)" label="Buy & hold" dashed />
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--gain)]">▲</span> achat
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--loss)]">◆</span> vente
            </span>
          </div>
        </CardContent>
      </Card>

      {result.trades.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Trades exécutés ({result.trades.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sens</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.trades.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="tabular text-muted-foreground">
                        {new Date(t.date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            t.action === "achat"
                              ? "text-[var(--gain)]"
                              : "text-[var(--loss)]",
                          )}
                        >
                          {t.action === "achat" ? "Achat" : "Vente"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular">{fmtEur(t.prix)}</TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">
                        {t.quantite ? fmtNum(t.quantite, 4) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {t.montant ? fmtEur(t.montant) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun trade déclenché avec ces paramètres — élargis les seuils RSI ou
          allonge la période.
        </p>
      )}
    </div>
  );
}

function Legend({
  color, label, dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-4 rounded"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          backgroundImage: dashed
            ? `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 7px)`
            : undefined,
        }}
      />
      {label}
    </span>
  );
}
