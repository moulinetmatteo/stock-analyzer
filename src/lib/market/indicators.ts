/**
 * Indicateurs techniques — portage 1:1 des formules pandas utilisées dans la
 * version Streamlit, pour que les signaux restent identiques entre les deux apps.
 */

/** Moyenne mobile exponentielle classique (span / adjust=False). */
export function ema(values: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const out: number[] = [];
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isNaN(prev)) {
      prev = v;
    } else {
      prev = alpha * v + (1 - alpha) * prev;
    }
    out.push(prev);
  }
  return out;
}

/**
 * EMA façon pandas `ewm(com=…, adjust=True)` — c'est la variante utilisée par le
 * RSI de Wilder dans la version Python, elle diffère de `adjust=False` sur les
 * premières barres.
 */
function ewmComAdjusted(values: number[], com: number, minPeriods: number): number[] {
  const alpha = 1 / (1 + com);
  const out: number[] = [];
  let num = 0;
  let den = 0;
  let seen = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    num = v + (1 - alpha) * num;
    den = 1 + (1 - alpha) * den;
    seen++;
    out.push(seen >= minPeriods ? num / den : NaN);
  }
  return out;
}

/** RSI de Wilder sur `length` périodes (défaut 14). */
export function rsi(close: number[], length = 14): number[] {
  const delta: number[] = [NaN];
  for (let i = 1; i < close.length; i++) delta.push(close[i] - close[i - 1]);

  const gains = delta.map((d) => (Number.isNaN(d) ? 0 : Math.max(d, 0)));
  const losses = delta.map((d) => (Number.isNaN(d) ? 0 : Math.max(-d, 0)));

  const avgGain = ewmComAdjusted(gains, length - 1, length);
  const avgLoss = ewmComAdjusted(losses, length - 1, length);

  return avgGain.map((g, i) => {
    const l = avgLoss[i];
    if (Number.isNaN(g) || Number.isNaN(l)) return NaN;
    if (l === 0) return 100;
    return 100 - 100 / (1 + g / l);
  });
}

export type MacdResult = { macd: number[]; signal: number[]; hist: number[] };

export function macd(close: number[], fast = 12, slow = 26, signalSpan = 9): MacdResult {
  const emaFast = ema(close, fast);
  const emaSlow = ema(close, slow);
  const line = emaFast.map((f, i) => f - emaSlow[i]);
  const sig = ema(line, signalSpan);
  return { macd: line, signal: sig, hist: line.map((m, i) => m - sig[i]) };
}

export type BollingerResult = { mid: number[]; upper: number[]; lower: number[] };

export function bollinger(close: number[], length = 20, stdMult = 2): BollingerResult {
  const mid = ema(close, length);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < close.length; i++) {
    if (i < length - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    const window = close.slice(i - length + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / length;
    // Écart-type échantillon (ddof=1), comme pandas .rolling().std()
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / (length - 1);
    const sd = Math.sqrt(variance);
    upper.push(mid[i] + stdMult * sd);
    lower.push(mid[i] - stdMult * sd);
  }
  return { mid, upper, lower };
}

export type StochResult = { k: number[]; d: number[] };

export function stochastic(
  high: number[], low: number[], close: number[], kPeriod = 14, dPeriod = 3,
): StochResult {
  const k: number[] = [];
  for (let i = 0; i < close.length; i++) {
    if (i < kPeriod - 1) {
      k.push(NaN);
      continue;
    }
    const lo = Math.min(...low.slice(i - kPeriod + 1, i + 1));
    const hi = Math.max(...high.slice(i - kPeriod + 1, i + 1));
    k.push(hi === lo ? NaN : ((close[i] - lo) / (hi - lo)) * 100);
  }
  const d: number[] = k.map((_, i) => {
    if (i < dPeriod - 1) return NaN;
    const win = k.slice(i - dPeriod + 1, i + 1);
    if (win.some(Number.isNaN)) return NaN;
    return win.reduce((a, b) => a + b, 0) / dPeriod;
  });
  return { k, d };
}

export type SignalLevel =
  | "ACHAT fort" | "Achat possible" | "Neutre" | "Vente possible" | "VENTE forte" | "—";

export type SignalInput = {
  rsi?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  stochK?: number | null;
  close?: number | null;
  bbLow?: number | null;
  bbUp?: number | null;
};

const ok = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && !Number.isNaN(v);

/**
 * Score de consensus : chaque indicateur vote achat ou vente, 3 votes alignés
 * donnent un signal fort. Même logique que `signal_badge` côté Python.
 */
export function signalBadge(input: SignalInput): { label: SignalLevel; score: number } {
  if (!ok(input.rsi)) return { label: "—", score: 0 };

  let buy = 0;
  let sell = 0;

  if (input.rsi < 30) buy++;
  if (input.rsi > 70) sell++;

  if (ok(input.macd) && ok(input.macdSignal)) {
    if (input.macd > input.macdSignal) buy++;
    else sell++;
  }

  if (ok(input.stochK)) {
    if (input.stochK < 20) buy++;
    else if (input.stochK > 80) sell++;
  }

  if (ok(input.close) && ok(input.bbLow)) {
    if (input.close <= input.bbLow) buy++;
    else if (ok(input.bbUp) && input.close >= input.bbUp) sell++;
  }

  if (buy >= 3) return { label: "ACHAT fort", score: buy };
  if (buy === 2) return { label: "Achat possible", score: buy };
  if (sell >= 3) return { label: "VENTE forte", score: -sell };
  if (sell === 2) return { label: "Vente possible", score: -sell };
  return { label: "Neutre", score: 0 };
}

export function signalVariant(label: SignalLevel): "gain" | "loss" | "muted" {
  if (label === "ACHAT fort" || label === "Achat possible") return "gain";
  if (label === "VENTE forte" || label === "Vente possible") return "loss";
  return "muted";
}
