"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtNum } from "@/lib/utils";

export type ChartPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20: number;
  ema50: number;
  ema200: number;
  bbUpper: number;
  bbLower: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  stochK: number;
  stochD: number;
  /** [min, max] — encode la mèche comme une barre flottante Recharts. */
  wick: [number, number];
  /** [open, close] trié — corps de la bougie. */
  body: [number, number];
};

const GRID = "var(--border)";
const AXIS = "var(--muted-foreground)";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Corps + mèche dessinés ensemble, colorés selon le sens de la bougie. */
function Candle(props: {
  x?: number; y?: number; width?: number; height?: number;
  payload?: ChartPoint; background?: { y: number; height: number };
}) {
  const { x = 0, width = 0, payload } = props;
  if (!payload) return null;

  const up = payload.close >= payload.open;
  const color = up ? "var(--gain)" : "var(--loss)";
  const { y = 0, height = 0 } = props;
  const cx = x + width / 2;

  // La barre reçue couvre [low, high] ; on recalcule le corps proportionnellement.
  const range = payload.high - payload.low || 1;
  const bodyTop = Math.max(payload.open, payload.close);
  const bodyBottom = Math.min(payload.open, payload.close);
  const yTop = y + ((payload.high - bodyTop) / range) * height;
  const bodyH = Math.max(((bodyTop - bodyBottom) / range) * height, 1);
  const bodyW = Math.max(width * 0.62, 1);

  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={yTop} width={bodyW} height={bodyH} fill={color} />
    </g>
  );
}

function ChartTooltip({
  active, payload, unit = "€",
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const up = p.close >= p.open;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{fmtDate(p.date)}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular">
        <dt className="text-muted-foreground">Ouv.</dt>
        <dd className="text-right">{fmtNum(p.open)} {unit}</dd>
        <dt className="text-muted-foreground">Haut</dt>
        <dd className="text-right">{fmtNum(p.high)} {unit}</dd>
        <dt className="text-muted-foreground">Bas</dt>
        <dd className="text-right">{fmtNum(p.low)} {unit}</dd>
        <dt className="text-muted-foreground">Clôt.</dt>
        <dd
          className="text-right font-medium"
          style={{ color: up ? "var(--gain)" : "var(--loss)" }}
        >
          {fmtNum(p.close)} {unit}
        </dd>
      </dl>
    </div>
  );
}

export function PriceChart({
  data,
  showBollinger = true,
  showEma200 = true,
}: {
  data: ChartPoint[];
  showBollinger?: boolean;
  showEma200?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: AXIS, fontSize: 11 }}
          minTickGap={40}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickFormatter={(v: number) => fmtNum(v, 0)}
          width={52}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} />

        {showBollinger && (
          <>
            <Line
              dataKey="bbUpper" dot={false} strokeWidth={1}
              stroke="var(--muted-foreground)" strokeOpacity={0.4} isAnimationActive={false}
            />
            <Line
              dataKey="bbLower" dot={false} strokeWidth={1}
              stroke="var(--muted-foreground)" strokeOpacity={0.4} isAnimationActive={false}
            />
          </>
        )}

        <Bar dataKey="wick" shape={<Candle />} isAnimationActive={false} />

        <Line
          dataKey="ema20" dot={false} strokeWidth={1.5}
          stroke="var(--chart-3)" isAnimationActive={false}
        />
        <Line
          dataKey="ema50" dot={false} strokeWidth={1.5}
          stroke="var(--chart-4)" isAnimationActive={false}
        />
        {showEma200 && (
          <Line
            dataKey="ema200" dot={false} strokeWidth={1.5} strokeDasharray="4 3"
            stroke="var(--chart-5)" isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RsiChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" hide />
        <YAxis
          domain={[0, 100]}
          ticks={[30, 70]}
          tick={{ fill: AXIS, fontSize: 11 }}
          width={52}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceArea y1={70} y2={100} fill="var(--loss)" fillOpacity={0.07} />
        <ReferenceArea y1={0} y2={30} fill="var(--gain)" fillOpacity={0.07} />
        <ReferenceLine y={70} stroke="var(--loss)" strokeDasharray="3 3" />
        <ReferenceLine y={30} stroke="var(--gain)" strokeDasharray="3 3" />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md tabular">
                RSI {fmtNum(payload[0].payload.rsi, 1)}
              </div>
            ) : null
          }
        />
        <Line
          dataKey="rsi" dot={false} strokeWidth={1.8}
          stroke="var(--chart-4)" isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MacdChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" hide />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          width={52}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmtNum(v, 1)}
        />
        <ReferenceLine y={0} stroke={GRID} />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md tabular">
                MACD {fmtNum(payload[0].payload.macd, 2)}
              </div>
            ) : null
          }
        />
        <Bar dataKey="macdHist" isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.macdHist >= 0 ? "var(--gain)" : "var(--loss)"} />
          ))}
        </Bar>
        <Line
          dataKey="macd" dot={false} strokeWidth={1.5}
          stroke="var(--chart-3)" isAnimationActive={false}
        />
        <Line
          dataKey="macdSignal" dot={false} strokeWidth={1.5}
          stroke="var(--chart-4)" isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <XAxis dataKey="date" hide />
        <YAxis hide />
        <Bar dataKey="volume" isAnimationActive={false} fill="var(--muted-foreground)" fillOpacity={0.45} />
      </BarChart>
    </ResponsiveContainer>
  );
}
