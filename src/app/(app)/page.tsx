import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPortfolio, getAlerts } from "@/lib/data";
import { getEurUsd, getSnapshots, getEarningsDate } from "@/lib/market/quotes";
import { WATCHLIST, WATCHLIST_BY_TICKER } from "@/lib/market/constants";
import { StatCard, StatGrid, PageHeader, SectionTitle } from "@/components/stat-card";
import { RsiPill, DeltaText } from "@/components/signal-badge";
import { Heatmap } from "@/components/heatmap";
import { fmtEur, fmtPct } from "@/lib/utils";
import { ArrowDown, ArrowUp, Bell, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const eurusd = await getEurUsd();

  const [portfolio, alerts] = await Promise.all([
    getPortfolio(user.username),
    getAlerts(user.username),
  ]);

  const watchTickers = WATCHLIST.map((w) => w.ticker);
  const allTickers = [...new Set([...watchTickers, ...portfolio.map((p) => p.ticker)])];
  const snaps = await getSnapshots(allTickers, "3mo", eurusd);

  // Seules les lignes valorisées entrent dans les totaux : un ticker introuvable
  // ferait autrement apparaître une perte de 100 %.
  let totalVal = 0;
  let totalInvest = 0;
  let unpriced = 0;
  for (const p of portfolio) {
    const s = snaps.get(p.ticker);
    if (!s) { unpriced++; continue; }
    totalVal += p.quantite * s.priceEur;
    totalInvest += p.quantite * p.prix_achat;
  }
  const pnl = totalVal - totalInvest;
  const pnlPct = totalInvest ? (pnl / totalInvest) * 100 : 0;

  const movers = WATCHLIST.map((w) => {
    const s = snaps.get(w.ticker);
    return s ? { ...w, price: s.priceEur, change: s.changePct, rsi: s.rsi } : null;
  })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.change - a.change);

  const rsiBuy = movers.filter((m) => m.rsi !== null && m.rsi < 30).sort((a, b) => a.rsi! - b.rsi!);
  const rsiSell = movers.filter((m) => m.rsi !== null && m.rsi > 70).sort((a, b) => b.rsi! - a.rsi!);

  type Triggered = { ticker: string; nom: string; price: number; kind: "achat" | "vente"; seuil: number };
  const triggered: Triggered[] = [];
  for (const a of alerts) {
    const s = snaps.get(a.ticker);
    if (!s) continue;
    if (a.seuil_bas && s.priceEur <= a.seuil_bas) {
      triggered.push({ ticker: a.ticker, nom: a.nom, price: s.priceEur, kind: "achat", seuil: a.seuil_bas });
    } else if (a.seuil_haut && s.priceEur >= a.seuil_haut) {
      triggered.push({ ticker: a.ticker, nom: a.nom, price: s.priceEur, kind: "vente", seuil: a.seuil_haut });
    }
  }

  const advancing = movers.filter((m) => m.change > 0).length;
  const breadth = movers.length ? Math.round((advancing / movers.length) * 100) : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Bonjour ${user.name}`}
        description={`${movers.length} titres suivis · ${advancing} en hausse aujourd'hui`}
      />

      {portfolio.length > 0 && (
        <StatGrid>
          <StatCard label="Valeur du portefeuille" value={fmtEur(totalVal)} size="lg" />
          <StatCard label="Montant investi" value={fmtEur(totalInvest)} size="lg" />
          <StatCard
            label="Plus / moins-value"
            value={fmtEur(pnl)}
            size="lg"
            delta={fmtPct(pnlPct)}
            deltaTone={pnl > 0 ? "gain" : pnl < 0 ? "loss" : "muted"}
          />
          <StatCard
            label="Positions"
            value={String(portfolio.length)}
            size="lg"
            hint={unpriced ? `dont ${unpriced} sans cours` : undefined}
          />
        </StatGrid>
      )}

      {triggered.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <Bell className="text-warn size-4" />
            <span className="text-sm font-medium">
              {triggered.length} alerte{triggered.length > 1 ? "s" : ""} déclenchée
              {triggered.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="divide-y">
            {triggered.map((t) => (
              <li key={t.ticker} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">
                  {t.nom} <span className="text-muted-foreground ml-1 font-mono text-xs">{t.ticker}</span>
                </span>
                <span
                  className="tabular"
                  style={{ color: t.kind === "achat" ? "var(--gain)" : "var(--loss)" }}
                >
                  {fmtEur(t.price)} {t.kind === "achat" ? "≤" : "≥"} {fmtEur(t.seuil)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MoverList title="Plus fortes hausses" direction="up" rows={movers.slice(0, 5)} />
        <MoverList title="Plus fortes baisses" direction="down" rows={movers.slice(-5).reverse()} />
      </div>

      <section className="surface-card p-5">
        <SectionTitle aside={`${breadth} % des titres en hausse`}>
          Heatmap du marché
        </SectionTitle>
        <Heatmap
          data={movers.map((m) => ({
            secteur: m.secteur, nom: m.nom, ticker: m.ticker, change: m.change,
          }))}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <OpportunityList
          title="Zone d'achat"
          caption="RSI sous 30 — survente"
          tone="gain"
          rows={rsiBuy}
          empty="Aucun titre en survente."
        />
        <OpportunityList
          title="Zone de vente"
          caption="RSI au-dessus de 70 — surachat"
          tone="loss"
          rows={rsiSell}
          empty="Aucun titre en surachat."
        />
      </div>

      <section className="surface-card p-5">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="text-muted-foreground size-4" />
            Prochains résultats
          </span>
        </SectionTitle>
        <Suspense fallback={<p className="text-muted-foreground text-sm">Chargement…</p>}>
          <EarningsList portfolioTickers={portfolio.map((p) => p.ticker)} />
        </Suspense>
      </section>
    </div>
  );
}

function MoverList({
  title,
  direction,
  rows,
}: {
  title: string;
  direction: "up" | "down";
  rows: { ticker: string; nom: string; price: number; change: number }[];
}) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  const tone = direction === "up" ? "var(--gain)" : "var(--loss)";

  return (
    <section className="surface-card p-5">
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <Icon className="size-4" style={{ color: tone }} strokeWidth={2.5} />
          {title}
        </span>
      </SectionTitle>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.ticker}>
            <Link
              href={`/analyse?ticker=${encodeURIComponent(r.ticker)}`}
              className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors"
            >
              <span className="min-w-0 truncate">
                {r.nom}
                <span className="text-muted-foreground ml-1.5 font-mono text-[0.7rem]">
                  {r.ticker}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-4">
                <span className="tabular text-muted-foreground">{fmtEur(r.price)}</span>
                <span className="w-[4.5rem] text-right">
                  <DeltaText value={r.change} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OpportunityList({
  title,
  caption,
  tone,
  rows,
  empty,
}: {
  title: string;
  caption: string;
  tone: "gain" | "loss";
  rows: { ticker: string; nom: string; price: number; rsi: number | null }[];
  empty: string;
}) {
  return (
    <section className="surface-card p-5">
      <SectionTitle aside={caption}>
        <span className="inline-flex items-center gap-2">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: `var(--${tone})` }}
          />
          {title}
        </span>
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-3 text-sm">{empty}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.ticker}>
              <Link
                href={`/analyse?ticker=${encodeURIComponent(r.ticker)}`}
                className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors"
              >
                <span className="truncate">{r.nom}</span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="tabular text-muted-foreground">{fmtEur(r.price)}</span>
                  <RsiPill value={r.rsi} gauge />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function EarningsList({ portfolioTickers }: { portfolioTickers: string[] }) {
  const candidates = [
    ...new Set([...portfolioTickers, ...WATCHLIST.slice(0, 20).map((w) => w.ticker)]),
  ].slice(0, 24);

  const today = new Date().toISOString().slice(0, 10);
  const results = await Promise.all(
    candidates.map(async (t) => ({ ticker: t, date: await getEarningsDate(t) })),
  );

  const rows = results
    .filter((r): r is { ticker: string; date: string } => !!r.date && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  if (!rows.length) {
    return <p className="text-muted-foreground text-sm">Aucune date connue prochainement.</p>;
  }

  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const w = WATCHLIST_BY_TICKER.get(r.ticker);
        const held = portfolioTickers.includes(r.ticker);
        const days = Math.round(
          (new Date(r.date).getTime() - new Date(today).getTime()) / 86400000,
        );
        return (
          <li key={r.ticker} className="flex items-center justify-between py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{w?.nom ?? r.ticker}</span>
              {held && (
                <span className="bg-[var(--gain-soft)] text-[var(--gain)] rounded px-1.5 py-0.5 text-[0.65rem] font-medium">
                  en portefeuille
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-muted-foreground tabular text-xs">
                {days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} j`}
              </span>
              <span className="tabular w-[5.5rem] text-right">
                {new Date(r.date).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "short", year: "2-digit",
                })}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
