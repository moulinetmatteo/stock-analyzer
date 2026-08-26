import type { EnrichedSeries } from "./quotes";
import type { ChartPoint } from "@/components/charts/price-chart";

/**
 * Convertit une série enrichie en points de graphique, prix convertis en euros.
 * `fx` vaut 1 pour un titre déjà libellé en euros, sinon 1/EURUSD.
 */
export function toChartPoints(s: EnrichedSeries, fx: number): ChartPoint[] {
  return s.candles.map((c, i) => {
    const open = c.open * fx;
    const high = c.high * fx;
    const low = c.low * fx;
    const close = c.close * fx;
    return {
      date: c.date,
      open, high, low, close,
      volume: c.volume,
      ema20: s.ema20[i] * fx,
      ema50: s.ema50[i] * fx,
      ema200: s.ema200[i] * fx,
      bbUpper: s.bbUpper[i] * fx,
      bbLower: s.bbLower[i] * fx,
      rsi: s.rsi[i],
      macd: s.macd[i] * fx,
      macdSignal: s.macdSignal[i] * fx,
      macdHist: s.macdHist[i] * fx,
      stochK: s.stochK[i],
      stochD: s.stochD[i],
      wick: [low, high],
      body: [Math.min(open, close), Math.max(open, close)],
    };
  });
}
