import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  getEurUsd, getSeries, sliceToPeriod, getFundamentals, getNews,
} from "@/lib/market/quotes";
import { signalBadge } from "@/lib/market/indicators";
import type { PeriodKey } from "@/lib/market/constants";
import { PERIODS } from "@/lib/market/constants";
import type { Position } from "@/lib/data";

/**
 * Client construit à la demande : `new Anthropic()` lève sans clé, et ce module
 * est importé par la route même quand la fonctionnalité n'est pas configurée —
 * on veut alors un 503 explicite, pas un 500 au chargement.
 */
let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Le modèle ne reçoit que des chiffres déjà calculés : il lit et met en
 * relation, il ne recalcule rien. Cela évite qu'il invente des valeurs, et rend
 * l'analyse vérifiable ligne à ligne contre ce qu'affiche la page.
 */
const SYSTEM = `Tu es analyste technique. On te fournit des indicateurs déjà calculés sur un titre ; tu les lis et les mets en relation.

Écris en français, pour quelqu'un qui connaît les bases de l'analyse technique sans être professionnel.

Structure ta réponse ainsi, sans titres en gras ni listes à puces décoratives :

1. Une phrase de synthèse : où en est le titre.
2. Ce sur quoi les indicateurs s'accordent, et surtout ce sur quoi ils divergent — c'est le plus utile.
3. Les niveaux qui comptent : bandes de Bollinger, plus-haut et plus-bas 52 semaines, moyennes mobiles proches du cours.
4. Ce qui invaliderait cette lecture.

Règles :
- N'utilise que les chiffres fournis. Si une donnée manque, dis-le au lieu de l'estimer.
- Ne donne pas de recommandation d'achat ou de vente, et n'annonce aucun objectif de cours. Décris ce que disent les indicateurs, la décision revient au lecteur.
- Les indicateurs techniques décrivent le passé récent ; ils ne prédisent rien. Reste sobre sur l'incertitude plutôt que d'ajouter un avertissement en fin de texte.
- 250 mots environ. Pas d'introduction ni de conclusion de politesse.`;

const num = (v: number) => (Number.isNaN(v) ? null : v);
const f = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "non disponible" : v.toFixed(d);

/** Rassemble tout ce que l'app sait déjà du titre, en texte lisible. */
export async function buildContext(
  ticker: string,
  period: PeriodKey,
  position?: Position,
): Promise<{ label: string; context: string } | null> {
  const [eurusd, full] = await Promise.all([getEurUsd(), getSeries(ticker, period)]);
  if (!full) return null;

  const s = sliceToPeriod(full, period);
  const fx = s.currency === "EUR" ? 1 : 1 / eurusd;
  const i = s.candles.length - 1;
  if (i < 1) return null;

  const price = s.candles[i].close * fx;
  const prev = s.candles[i - 1].close * fx;
  const first = s.candles[0].close * fx;

  // RSI et stochastique sont des pourcentages, ils ne se convertissent pas.
  // Tout le reste est exprimé en unités de prix et doit passer en euros comme
  // le cours, sinon on compare des dollars à des euros sous la même étiquette.
  const eur = (v: number | null) => (v === null ? null : v * fx);

  const rsi = num(s.rsi[i]);
  const stochK = num(s.stochK[i]);
  const stochD = num(s.stochD[i]);

  const macd = eur(num(s.macd[i]));
  const macdSig = eur(num(s.macdSignal[i]));
  const ema20 = eur(num(s.ema20[i]));
  const ema50 = eur(num(s.ema50[i]));
  const ema200 = eur(num(s.ema200[i]));
  const bbUp = eur(num(s.bbUpper[i]));
  const bbLow = eur(num(s.bbLower[i]));

  const sig = signalBadge({
    rsi, macd, macdSignal: macdSig, stochK,
    close: s.candles[i].close, bbLow: num(s.bbLower[i]), bbUp: num(s.bbUpper[i]),
  });

  const [fund, news] = await Promise.all([getFundamentals(ticker), getNews(ticker)]);
  const label = fund?.longName ?? ticker;

  const highs = s.candles.map((c) => c.high * fx);
  const lows = s.candles.map((c) => c.low * fx);

  const lines: string[] = [
    `Titre : ${label} (${ticker}), coté en ${s.currency}.`,
    `Tous les montants ci-dessous sont convertis en euros au taux du jour (1 € = ${eurusd.toFixed(4)} $).`,
    `Période analysée : ${PERIODS[period].label}, ${s.candles.length} séances.`,
    "",
    "Cours",
    `- Dernier : ${f(price)} €, veille ${f(prev)} € (${(((price - prev) / prev) * 100).toFixed(2)} %).`,
    `- Sur la période : départ ${f(first)} €, variation ${(((price - first) / first) * 100).toFixed(2)} %.`,
    `- Extrêmes de la période : plus haut ${f(Math.max(...highs))} €, plus bas ${f(Math.min(...lows))} €.`,
    "",
    "Indicateurs techniques",
    `- RSI 14 : ${f(rsi, 1)}`,
    `- MACD : ${f(macd, 3)}, ligne de signal ${f(macdSig, 3)}${
      macd !== null && macdSig !== null
        ? macd > macdSig ? " (MACD au-dessus du signal)" : " (MACD sous le signal)"
        : ""
    }`,
    `- Stochastique : %K ${f(stochK, 1)}, %D ${f(stochD, 1)}`,
    `- Bollinger 20 : bande haute ${f(bbUp)} €, bande basse ${f(bbLow)} €`,
    `- Moyennes mobiles : EMA 20 ${f(ema20)} €, EMA 50 ${f(ema50)} €, EMA 200 ${f(ema200)} €`,
    ema50 !== null && ema200 !== null
      ? `- Croisement : EMA 50 ${ema50 > ema200 ? "au-dessus" : "en dessous"} de l'EMA 200 (${ema50 > ema200 ? "golden cross" : "death cross"})`
      : "- Croisement : non disponible",
    `- Signal de consensus calculé par l'application : ${sig.label}`,
  ];

  if (fund) {
    lines.push(
      "",
      "Données fondamentales",
      `- Secteur : ${fund.sector}`,
      `- Capitalisation : ${fund.marketCap ? `${(fund.marketCap / eurusd / 1e9).toFixed(1)} Md€` : "non disponible"}`,
      `- PER : ${f(fund.peRatio, 1)}`,
      `- Bêta : ${f(fund.beta, 2)}`,
      `- Rendement du dividende : ${fund.dividendYield ? `${fund.dividendYield.toFixed(2)} %` : "aucun"}`,
      `- Plus haut 52 semaines : ${fund.fiftyTwoWeekHigh ? `${f(fund.fiftyTwoWeekHigh * fx)} €` : "non disponible"}`,
      `- Plus bas 52 semaines : ${fund.fiftyTwoWeekLow ? `${f(fund.fiftyTwoWeekLow * fx)} €` : "non disponible"}`,
    );
  }

  if (position) {
    const invest = position.quantite * position.prix_achat;
    const value = position.quantite * price;
    const pnlPct = ((price - position.prix_achat) / position.prix_achat) * 100;
    lines.push(
      "",
      "Position détenue par le lecteur",
      `- ${position.quantite} titre(s), prix de revient ${f(position.prix_achat)} €.`,
      `- Investi ${f(invest)} €, valorisé ${f(value)} €, soit ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)} %.`,
      "Tu peux en tenir compte pour situer le cours actuel par rapport à son prix d'entrée, sans lui dire quoi faire.",
    );
  }

  if (news.length) {
    lines.push(
      "",
      "Titres de presse récents (titres seuls, tu n'as pas lu les articles)",
      ...news.slice(0, 6).map((n) => `- ${n.title} (${n.publisher})`),
    );
  }

  return { label, context: lines.join("\n") };
}

/** Analyse en flux : le texte arrive au fil de l'eau plutôt qu'en bloc. */
export async function streamAnalysis(context: string) {
  return getClient().beta.messages.stream({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM,
    // Adaptatif : la mise en relation d'indicateurs contradictoires mérite
    // une réflexion, une lecture triviale n'en consommera pas.
    thinking: { type: "adaptive" },
    // Sur un refus de politique, la requête est rejouée sur un modèle de repli
    // dans le même appel plutôt que de s'arrêter net.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: context }],
  });
}
