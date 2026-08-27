"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Line, ReferenceArea, ReferenceLine, XAxis, YAxis,
} from "recharts";
import {
  ChartContainer, ChartTooltip, type ChartConfig,
} from "@/components/ui/chart";
import { fmtNum } from "@/lib/utils";

export type ChartPoint = {
  date: string;
  open: number; high: number; low: number; close: number;
  volume: number;
  ema20: number; ema50: number; ema200: number;
  bbUpper: number; bbLower: number;
  rsi: number;
  macd: number; macdSignal: number; macdHist: number;
  stochK: number; stochD: number;
  /** [bas, haut] — la mèche, encodée en barre flottante Recharts. */
  wick: [number, number];
  body: [number, number];
};

const priceConfig = {
  ema20: { label: "EMA 20", color: "var(--chart-1)" },
  ema50: { label: "EMA 50", color: "var(--chart-4)" },
  ema200: { label: "EMA 200", color: "var(--chart-5)" },
} satisfies ChartConfig;

const axisTick = { fontSize: 11 } as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Corps et mèche dessinés ensemble, couleur donnée par le sens de la bougie. */
function Candle(props: {
  x?: number; y?: number; width?: number; height?: number; payload?: ChartPoint;
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;

  const up = payload.close >= payload.open;
  const color = up ? "var(--gain)" : "var(--loss)";
  const cx = x + width / 2;

  // La barre couvre [low, high] ; on replace le corps proportionnellement.
  const range = payload.high - payload.low || 1;
  const top = Math.max(payload.open, payload.close);
  const bottom = Math.min(payload.open, payload.close);
  const yBody = y + ((payload.high - top) / range) * height;
  const hBody = Math.max(((top - bottom) / range) * height, 1);
  const wBody = Math.max(width * 0.66, 1);

  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - wBody / 2} y={yBody} width={wBody} height={hBody} fill={color} rx={0.5} />
    </g>
  );
}

function OhlcTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const up = p.close >= p.open;
  const change = ((p.close - p.open) / p.open) * 100;

  const Row = ({ k, v }: { k: string; v: string }) => (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </>
  );

  return (
    <div className="border-border/50 bg-popover grid min-w-[9rem] gap-1.5 rounded-lg border px-2.5 py-2 text-xs shadow-xl">
      <div className="flex items-baseline justify-between gap-3 border-b pb-1.5">
        <span className="font-medium">{fmtDate(p.date)}</span>
        <span
          className="tabular-nums font-medium"
          style={{ color: up ? "var(--gain)" : "var(--loss)" }}
        >
          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <Row k="Ouverture" v={fmtNum(p.open)} />
        <Row k="Haut" v={fmtNum(p.high)} />
        <Row k="Bas" v={fmtNum(p.low)} />
        <Row k="Clôture" v={fmtNum(p.close)} />
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
    <ChartContainer config={priceConfig} className="aspect-auto h-[320px] w-full">
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={44}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={46}
          tickFormatter={(v: number) => fmtNum(v, 0)}
        />
        <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<OhlcTooltip />} />

        {showBollinger && (
          <>
            <Area
              dataKey="bbUpper" stroke="none" fill="var(--muted-foreground)"
              fillOpacity={0.05} isAnimationActive={false} activeDot={false}
            />
            <Line
              dataKey="bbUpper" dot={false} strokeWidth={1} strokeDasharray="2 3"
              stroke="var(--muted-foreground)" strokeOpacity={0.45} isAnimationActive={false}
            />
            <Line
              dataKey="bbLower" dot={false} strokeWidth={1} strokeDasharray="2 3"
              stroke="var(--muted-foreground)" strokeOpacity={0.45} isAnimationActive={false}
            />
          </>
        )}

        <Bar dataKey="wick" shape={<Candle />} isAnimationActive={false} />

        <Line dataKey="ema20" dot={false} strokeWidth={1.5} stroke="var(--color-ema20)" isAnimationActive={false} />
        <Line dataKey="ema50" dot={false} strokeWidth={1.5} stroke="var(--color-ema50)" isAnimationActive={false} />
        {showEma200 && (
          <Line
            dataKey="ema200" dot={false} strokeWidth={1.5} strokeDasharray="4 3"
            stroke="var(--color-ema200)" isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

const rsiConfig = { rsi: { label: "RSI", color: "var(--chart-1)" } } satisfies ChartConfig;

export function RsiChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartContainer config={rsiConfig} className="aspect-auto h-[110px] w-full">
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" hide />
        <YAxis
          domain={[0, 100]} ticks={[30, 70]} tick={axisTick}
          tickLine={false} axisLine={false} tickMargin={6} width={46}
        />
        <ReferenceArea y1={70} y2={100} fill="var(--loss)" fillOpacity={0.035} />
        <ReferenceArea y1={0} y2={30} fill="var(--gain)" fillOpacity={0.035} />
        <ReferenceLine y={70} stroke="var(--loss)" strokeOpacity={0.4} strokeDasharray="3 3" />
        <ReferenceLine y={30} stroke="var(--gain)" strokeOpacity={0.4} strokeDasharray="3 3" />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-1.5 text-xs tabular-nums shadow-xl">
                RSI <span className="font-medium">{fmtNum(payload[0].payload.rsi, 1)}</span>
              </div>
            ) : null
          }
        />
        <Line dataKey="rsi" dot={false} strokeWidth={1.8} stroke="var(--color-rsi)" isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

const macdConfig = {
  macd: { label: "MACD", color: "var(--chart-1)" },
  macdSignal: { label: "Signal", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function MacdChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartContainer config={macdConfig} className="aspect-auto h-[110px] w-full">
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" hide />
        <YAxis
          tick={axisTick} tickLine={false} axisLine={false} tickMargin={6} width={46}
          tickFormatter={(v: number) => fmtNum(v, 1)}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-1.5 text-xs tabular-nums shadow-xl">
                MACD <span className="font-medium">{fmtNum(payload[0].payload.macd, 2)}</span>
              </div>
            ) : null
          }
        />
        <Bar dataKey="macdHist" isAnimationActive={false} radius={1}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.macdHist >= 0 ? "var(--gain)" : "var(--loss)"}
              fillOpacity={0.55}
            />
          ))}
        </Bar>
        <Line dataKey="macd" dot={false} strokeWidth={1.5} stroke="var(--color-macd)" isAnimationActive={false} />
        <Line dataKey="macdSignal" dot={false} strokeWidth={1.5} stroke="var(--color-macdSignal)" isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

const volumeConfig = { volume: { label: "Volume", color: "var(--muted-foreground)" } } satisfies ChartConfig;

export function VolumeChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartContainer config={volumeConfig} className="aspect-auto h-[70px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" hide />
        <YAxis hide width={46} />
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="border-border/50 bg-popover rounded-lg border px-2.5 py-1.5 text-xs tabular-nums shadow-xl">
                {new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(
                  payload[0].payload.volume,
                )}{" "}
                titres
              </div>
            ) : null
          }
        />
        {/* Le volume est teinté par le sens de la séance : il se lit avec le prix. */}
        <Bar dataKey="volume" isAnimationActive={false} radius={1}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.close >= d.open ? "var(--gain)" : "var(--loss)"}
              fillOpacity={0.35}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
