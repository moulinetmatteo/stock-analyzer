import "server-only";
import {
  getAlerts, getCustomWatchlist, getAllTelegramTargets,
  getRsiState, saveRsiStates, getAlertNotifiedDates, markAlertNotified,
  type RsiState, type RsiZone, type TelegramTarget,
} from "@/lib/data";
import { getEurUsd, getSnapshots } from "@/lib/market/quotes";
import { WATCHLIST } from "@/lib/market/constants";

/** Jour courant à Paris — le cron tourne en UTC, les bornes doivent être locales. */
function parisDay(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const eur = (v: number) => `${v.toFixed(2)} €`;

async function sendTelegram(t: TelegramTarget, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${t.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: t.chat_id, text, parse_mode: "HTML" }),
    });
    const json = await res.json();
    if (!json.ok) console.error(`[cron] Telegram ${t.user_id} :`, json.description);
    return Boolean(json.ok);
  } catch (e) {
    console.error(`[cron] Telegram ${t.user_id} injoignable :`, e);
    return false;
  }
}

export type RunSummary = {
  users: number;
  priceAlerts: number;
  rsiAlerts: number;
  scans: number;
  errors: string[];
  /** En simulation, les messages qui auraient été envoyés. */
  preview?: string[];
};

/**
 * En simulation, rien n'est envoyé ni écrit : on veut pouvoir vérifier le cron
 * sans notifier réellement, et sans consommer la déduplication du jour.
 */
export type RunOptions = { dryRun?: boolean };

// ── Alertes prix et bascules de zone RSI ─────────────────────────────────────

/**
 * Seuils de prix uniquement. Ne consulte que les titres réellement sous alerte,
 * donc quelques requêtes : c'est ce qui peut tourner à haute fréquence.
 */
export async function runPriceAlerts(opts: RunOptions = {}): Promise<RunSummary> {
  const dry = Boolean(opts.dryRun);
  const summary: RunSummary = {
    users: 0, priceAlerts: 0, rsiAlerts: 0, scans: 0, errors: [],
    ...(dry ? { preview: [] as string[] } : {}),
  };
  const deliver = async (t: TelegramTarget, text: string) => {
    if (dry) { summary.preview!.push(`→ ${t.user_id}\n${text}`); return true; }
    return sendTelegram(t, text);
  };
  const targets = await getAllTelegramTargets();
  if (!targets.length) return summary;

  const eurusd = await getEurUsd();
  const day = parisDay();
  summary.users = targets.length;

  for (const target of targets) {
    const uid = target.user_id;
    try {
      // ── Seuils de prix ────────────────────────────────────────────────────
      const alerts = await getAlerts(uid);
      if (alerts.length) {
        const notified = await getAlertNotifiedDates(uid);
        const snaps = await getSnapshots(alerts.map((a) => a.ticker), "1mo", eurusd);

        for (const a of alerts) {
          const snap = snaps.get(a.ticker);
          if (!snap) continue;

          // Une seule notification par alerte et par jour, même si le seuil
          // reste franchi pendant des heures.
          if (notified.get(a.ticker) === day) continue;

          const p = snap.priceEur;
          let msg: string | null = null;

          if (a.seuil_bas && p <= a.seuil_bas) {
            msg =
              `🟢 <b>Seuil d'achat atteint — ${esc(a.nom)}</b>\n` +
              `${eur(p)} ≤ ${eur(a.seuil_bas)}`;
          } else if (a.seuil_haut && p >= a.seuil_haut) {
            msg =
              `🔴 <b>Seuil de vente atteint — ${esc(a.nom)}</b>\n` +
              `${eur(p)} ≥ ${eur(a.seuil_haut)}`;
          }

          if (msg && (await deliver(target, msg))) {
            if (!dry) await markAlertNotified(uid, a.ticker, day);
            summary.priceAlerts++;
          }
        }
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${uid}: ${msg}`);
      console.error(`[cron] prix ${uid} :`, msg);
    }
  }

  return summary;
}

/**
 * Bascules de zone RSI sur toute la watchlist. Interroge une quarantaine de
 * titres sur trois mois : à cadence élevée, Yahoo finit par limiter. Un RSI ne
 * bouge pas assez en cinq minutes pour que ça vaille le coup.
 */
export async function runRsiAlerts(opts: RunOptions = {}): Promise<RunSummary> {
  const dry = Boolean(opts.dryRun);
  const summary: RunSummary = {
    users: 0, priceAlerts: 0, rsiAlerts: 0, scans: 0, errors: [],
    ...(dry ? { preview: [] as string[] } : {}),
  };
  const deliver = async (t: TelegramTarget, text: string) => {
    if (dry) { summary.preview!.push(`\u2192 ${t.user_id}\n${text}`); return true; }
    return sendTelegram(t, text);
  };
  const targets = await getAllTelegramTargets();
  if (!targets.length) return summary;

  const eurusd = await getEurUsd();
  const day = parisDay();
  summary.users = targets.length;

  for (const target of targets) {
    const uid = target.user_id;
    try {
      // ── Bascules de zone RSI ──────────────────────────────────────────────
      const previous = await getRsiState(uid);
      const tickers = WATCHLIST.map((w) => w.ticker);
      const snaps = await getSnapshots(tickers, "3mo", eurusd);

      const buys: string[] = [];
      const sells: string[] = [];
      const nextStates: RsiState[] = [];

      for (const w of WATCHLIST) {
        const snap = snaps.get(w.ticker);
        if (!snap || snap.rsi === null) continue;

        const zone: RsiZone = snap.rsi < 30 ? "buy" : snap.rsi > 70 ? "sell" : "neutral";
        const prev = previous.get(w.ticker);
        const prevZone = prev?.zone ?? "neutral";
        const alertedToday = prev?.alerted_date === day;

        // On ne signale que l'entrée dans une zone, pas le maintien dedans.
        if (zone !== prevZone && zone !== "neutral" && !alertedToday) {
          const line = `  • <b>${esc(w.nom)}</b> — ${eur(snap.priceEur)} · RSI ${snap.rsi.toFixed(1)}`;
          (zone === "buy" ? buys : sells).push(line);
        }

        nextStates.push({
          ticker: w.ticker,
          zone,
          alerted_date:
            zone !== "neutral" && zone !== prevZone ? day : (prev?.alerted_date ?? ""),
        });
      }

      if (buys.length || sells.length) {
        const lines = ["📊 <b>Changements de zone RSI</b>", ""];
        if (buys.length) lines.push("🟢 <b>Entrées en survente</b> (RSI &lt; 30)", ...buys);
        if (sells.length) {
          if (buys.length) lines.push("");
          lines.push("🔴 <b>Entrées en surachat</b> (RSI &gt; 70)", ...sells);
        }
        if (await deliver(target, lines.join("\n"))) {
          summary.rsiAlerts += buys.length + sells.length;
        }
      }

      // L'état RSI n'est pas avancé en simulation : sinon le vrai passage
      // suivant croirait les bascules déjà signalées.
      if (!dry) await saveRsiStates(uid, nextStates);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${uid}: ${msg}`);
      console.error(`[cron] ${uid} :`, msg);
    }
  }

  return summary;
}

// ── Scan matinal ─────────────────────────────────────────────────────────────

export async function runScan(opts: RunOptions = {}): Promise<RunSummary> {
  const dry = Boolean(opts.dryRun);
  const summary: RunSummary = {
    users: 0, priceAlerts: 0, rsiAlerts: 0, scans: 0, errors: [],
    ...(dry ? { preview: [] as string[] } : {}),
  };
  const deliver = async (t: TelegramTarget, text: string) => {
    if (dry) { summary.preview!.push(`→ ${t.user_id}\n${text}`); return true; }
    return sendTelegram(t, text);
  };
  const targets = await getAllTelegramTargets();
  if (!targets.length) return summary;

  const eurusd = await getEurUsd();
  summary.users = targets.length;

  for (const target of targets) {
    const uid = target.user_id;
    try {
      const custom = await getCustomWatchlist(uid);
      const universe = [
        ...WATCHLIST.map((w) => ({ nom: w.nom, ticker: w.ticker })),
        ...custom,
      ];
      const snaps = await getSnapshots(universe.map((u) => u.ticker), "3mo", eurusd);

      const strong: string[] = [];
      const weak: string[] = [];

      for (const u of universe) {
        const snap = snaps.get(u.ticker);
        if (!snap || snap.rsi === null || snap.rsi >= 30) continue;

        const macdUp =
          snap.macd !== null && snap.macdSignal !== null && snap.macd > snap.macdSignal;
        const line = `  • <b>${esc(u.nom)}</b> — ${eur(snap.priceEur)} · RSI ${snap.rsi.toFixed(1)}`;
        (macdUp ? strong : weak).push(line);
      }

      if (!strong.length && !weak.length) continue;

      const lines = ["📈 <b>Scan du matin — titres en survente</b>", ""];
      if (strong.length) {
        lines.push("🟢 <b>RSI &lt; 30 et MACD haussier</b>", ...strong);
      }
      if (weak.length) {
        if (strong.length) lines.push("");
        lines.push("🟡 <b>RSI &lt; 30</b>", ...weak);
      }

      if (await deliver(target, lines.join("\n"))) {
        summary.scans += strong.length + weak.length;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${uid}: ${msg}`);
      console.error(`[cron] scan ${uid} :`, msg);
    }
  }

  return summary;
}

/** Les deux à la suite — utilisé par un lancement manuel. */
export async function runAlerts(opts: RunOptions = {}): Promise<RunSummary> {
  const a = await runPriceAlerts(opts);
  const b = await runRsiAlerts(opts);
  return {
    users: Math.max(a.users, b.users),
    priceAlerts: a.priceAlerts,
    rsiAlerts: b.rsiAlerts,
    scans: 0,
    errors: [...a.errors, ...b.errors],
    ...(opts.dryRun ? { preview: [...(a.preview ?? []), ...(b.preview ?? [])] } : {}),
  };
}
