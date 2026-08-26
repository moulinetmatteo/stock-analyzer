"use client";

import { useState } from "react";
import {
  PriceChart, RsiChart, MacdChart, VolumeChart, type ChartPoint,
} from "@/components/charts/price-chart";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TOGGLES = [
  { id: "bollinger", label: "Bollinger" },
  { id: "ema200", label: "EMA 200" },
  { id: "volume", label: "Volume" },
  { id: "macd", label: "MACD" },
] as const;

type ToggleId = (typeof TOGGLES)[number]["id"];

export function AnalysisCharts({ points }: { points: ChartPoint[] }) {
  const [on, setOn] = useState<Record<ToggleId, boolean>>({
    bollinger: true,
    ema200: true,
    volume: true,
    macd: true,
  });

  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TOGGLES.map((t) => (
            <button
              key={t.id}
              onClick={() => setOn((s) => ({ ...s, [t.id]: !s[t.id] }))}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                on[t.id]
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
          <Legend />
        </div>

        <PriceChart
          data={points}
          showBollinger={on.bollinger}
          showEma200={on.ema200}
        />

        {on.volume && (
          <Panel title="Volume">
            <VolumeChart data={points} />
          </Panel>
        )}

        <Panel title="RSI (14)">
          <RsiChart data={points} />
        </Panel>

        {on.macd && (
          <Panel title="MACD">
            <MacdChart data={points} />
          </Panel>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-2">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Legend() {
  const items = [
    { label: "EMA 20", color: "var(--chart-3)" },
    { label: "EMA 50", color: "var(--chart-4)" },
    { label: "EMA 200", color: "var(--chart-5)" },
  ];
  return (
    <div className="ml-auto flex items-center gap-3">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
