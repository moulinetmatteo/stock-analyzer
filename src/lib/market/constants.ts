export const TICKER_CURRENCY: Record<string, "USD" | "EUR"> = {
  AAPL: "USD", MSFT: "USD", GOOGL: "USD", AMZN: "USD", NVDA: "USD",
  TSLA: "USD", META: "USD", NFLX: "USD", AMD: "USD", INTC: "USD",
  ORCL: "USD", CRM: "USD", ADBE: "USD", JPM: "USD", BAC: "USD",
  GS: "USD", V: "USD", MA: "USD", JNJ: "USD", PFE: "USD",
  UNH: "USD", XOM: "USD", CVX: "USD",
  SPY: "USD", QQQ: "USD", VTI: "USD", "IWDA.AS": "USD", "CSPX.AS": "USD",
  "MC.PA": "EUR", "TTE.PA": "EUR", "AIR.PA": "EUR", "SAN.PA": "EUR",
  "BNP.PA": "EUR", "OR.PA": "EUR", "SU.PA": "EUR", "CAP.PA": "EUR",
  "RMS.PA": "EUR", "KER.PA": "EUR",
};

export type WatchlistEntry = { nom: string; ticker: string; secteur: string };

export const WATCHLIST: WatchlistEntry[] = [
  { nom: "Apple", ticker: "AAPL", secteur: "US Tech" },
  { nom: "Microsoft", ticker: "MSFT", secteur: "US Tech" },
  { nom: "Google", ticker: "GOOGL", secteur: "US Tech" },
  { nom: "Amazon", ticker: "AMZN", secteur: "US Tech" },
  { nom: "NVIDIA", ticker: "NVDA", secteur: "US Tech" },
  { nom: "Tesla", ticker: "TSLA", secteur: "US Tech" },
  { nom: "Meta", ticker: "META", secteur: "US Tech" },
  { nom: "Netflix", ticker: "NFLX", secteur: "US Tech" },
  { nom: "AMD", ticker: "AMD", secteur: "US Tech" },
  { nom: "Intel", ticker: "INTC", secteur: "US Tech" },
  { nom: "Oracle", ticker: "ORCL", secteur: "US Tech" },
  { nom: "Salesforce", ticker: "CRM", secteur: "US Tech" },
  { nom: "Adobe", ticker: "ADBE", secteur: "US Tech" },
  { nom: "JPMorgan", ticker: "JPM", secteur: "US Finance" },
  { nom: "Bank of America", ticker: "BAC", secteur: "US Finance" },
  { nom: "Goldman Sachs", ticker: "GS", secteur: "US Finance" },
  { nom: "Visa", ticker: "V", secteur: "US Finance" },
  { nom: "Mastercard", ticker: "MA", secteur: "US Finance" },
  { nom: "Johnson & Johnson", ticker: "JNJ", secteur: "US Santé" },
  { nom: "Pfizer", ticker: "PFE", secteur: "US Santé" },
  { nom: "UnitedHealth", ticker: "UNH", secteur: "US Santé" },
  { nom: "ExxonMobil", ticker: "XOM", secteur: "US Énergie" },
  { nom: "Chevron", ticker: "CVX", secteur: "US Énergie" },
  { nom: "LVMH", ticker: "MC.PA", secteur: "France" },
  { nom: "TotalEnergies", ticker: "TTE.PA", secteur: "France" },
  { nom: "Airbus", ticker: "AIR.PA", secteur: "France" },
  { nom: "Sanofi", ticker: "SAN.PA", secteur: "France" },
  { nom: "BNP Paribas", ticker: "BNP.PA", secteur: "France" },
  { nom: "L'Oréal", ticker: "OR.PA", secteur: "France" },
  { nom: "Schneider Electric", ticker: "SU.PA", secteur: "France" },
  { nom: "Capgemini", ticker: "CAP.PA", secteur: "France" },
  { nom: "Hermès", ticker: "RMS.PA", secteur: "France" },
  { nom: "Kering", ticker: "KER.PA", secteur: "France" },
  { nom: "S&P 500 (SPY)", ticker: "SPY", secteur: "ETF" },
  { nom: "Nasdaq 100 (QQQ)", ticker: "QQQ", secteur: "ETF" },
  { nom: "MSCI World (IWDA)", ticker: "IWDA.AS", secteur: "ETF" },
  { nom: "Total US Market (VTI)", ticker: "VTI", secteur: "ETF" },
  { nom: "S&P 500 EUR (CSPX)", ticker: "CSPX.AS", secteur: "ETF" },
];

export const WATCHLIST_BY_TICKER = new Map(WATCHLIST.map((w) => [w.ticker, w]));

export const PERIODS = {
  "14d": { label: "14 jours", days: 14 },
  "1mo": { label: "1 mois", days: 30 },
  "3mo": { label: "3 mois", days: 90 },
  "6mo": { label: "6 mois", days: 180 },
  "1y": { label: "1 an", days: 365 },
  "2y": { label: "2 ans", days: 730 },
} as const;

export type PeriodKey = keyof typeof PERIODS;
