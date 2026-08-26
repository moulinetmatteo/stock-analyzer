export type Strategy = "rsi" | "macd" | "rsi_macd";

export type Trade = {
  date: string;
  action: "achat" | "vente";
  prix: number;
  quantite?: number;
  montant?: number;
};

export type BacktestResult = {
  equity: { date: string; strategy: number; buyHold: number }[];
  trades: Trade[];
  finalValue: number;
  totalReturn: number;
  buyHoldReturn: number;
  tradeCount: number;
  winRate: number | null;
};

export type BacktestInput = {
  dates: string[];
  close: number[];
  rsi: number[];
  macd: number[];
  macdSignal: number[];
  strategy: Strategy;
  rsiBuy: number;
  rsiSell: number;
  capital: number;
};

/**
 * Simulation « tout ou rien » : chaque signal d'achat investit la totalité du
 * cash, chaque signal de vente liquide la position. Aucun frais n'est modélisé.
 */
export function runBacktest(input: BacktestInput): BacktestResult {
  const { dates, close, rsi, macd, macdSignal, strategy, rsiBuy, rsiSell, capital } = input;

  let cash = capital;
  let shares = 0;
  let lastBuyPrice: number | null = null;
  let wins = 0;
  let closed = 0;

  const trades: Trade[] = [];
  const equity: BacktestResult["equity"] = [];

  for (let i = 0; i < close.length; i++) {
    const price = close[i];
    const r = Number.isNaN(rsi[i]) ? 50 : rsi[i];
    const m = Number.isNaN(macd[i]) ? 0 : macd[i];
    const ms = Number.isNaN(macdSignal[i]) ? 0 : macdSignal[i];

    let buy = false;
    let sell = false;

    if (strategy === "rsi") {
      buy = r < rsiBuy;
      sell = r > rsiSell;
    } else if (strategy === "macd") {
      const pm = i > 0 && !Number.isNaN(macd[i - 1]) ? macd[i - 1] : m;
      const pms = i > 0 && !Number.isNaN(macdSignal[i - 1]) ? macdSignal[i - 1] : ms;
      buy = m > ms && pm <= pms;
      sell = m < ms && pm >= pms;
    } else {
      buy = r < rsiBuy && m > ms;
      sell = r > rsiSell && m < ms;
    }

    if (buy && cash > 0) {
      shares = cash / price;
      cash = 0;
      lastBuyPrice = price;
      trades.push({ date: dates[i], action: "achat", prix: price, quantite: shares });
    } else if (sell && shares > 0) {
      cash = shares * price;
      if (lastBuyPrice !== null) {
        closed++;
        if (price > lastBuyPrice) wins++;
      }
      trades.push({ date: dates[i], action: "vente", prix: price, montant: cash });
      shares = 0;
      lastBuyPrice = null;
    }

    equity.push({
      date: dates[i],
      strategy: cash + shares * price,
      buyHold: (capital * price) / close[0],
    });
  }

  const finalValue = equity.at(-1)?.strategy ?? capital;
  const totalReturn = ((finalValue - capital) / capital) * 100;
  const buyHoldReturn = ((close.at(-1)! - close[0]) / close[0]) * 100;

  return {
    equity,
    trades,
    finalValue,
    totalReturn,
    buyHoldReturn,
    tradeCount: trades.length,
    winRate: closed > 0 ? (wins / closed) * 100 : null,
  };
}
