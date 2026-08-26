import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getPortfolio, getAlerts } from "@/lib/data";
import { getEurUsd, getSnapshots, getEarningsDate } from "@/lib/market/quotes";
import { WATCHLIST, WATCHLIST_BY_TICKER } from "@/lib/market/constants";
import { StatCard, StatGrid } from "@/components/stat-card";
import { RsiPill } from "@/components/signal-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heatmap } from "@/components/heatmap";
import { fmtEur, fmtPct, pnlColor } from "@/lib/utils";
import { ArrowDown, ArrowUp, Bell } from "lucide-react";

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

  // ── Valorisation du portefeuille ────────────────────────────────────────────
  // Seules les lignes effectivement valorisées entrent dans les totaux, sinon
  // un ticker introuvable ferait apparaître une perte de 100 %.
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

  // ── Mouvements du jour ──────────────────────────────────────────────────────
  const movers = WATCHLIST.map((w) => {
    const s = snaps.get(w.ticker);
    return s ? { ...w, price: s.priceEur, change: s.changePct } : null;
  })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.change - a.change);

  const topUp = movers.slice(0, 5);
  const topDown = movers.slice(-5).reverse();

  // ── Opportunités RSI ────────────────────────────────────────────────────────
  const rsiBuy = movers
    .map((m) => ({ ...m, rsi: snaps.get(m.ticker)?.rsi ?? null }))
    .filter((m) => m.rsi !== null && m.rsi < 30)
    .sort((a, b) => a.rsi! - b.rsi!);
  const rsiSell = movers
    .map((m) => ({ ...m, rsi: snaps.get(m.ticker)?.rsi ?? null }))
    .filter((m) => m.rsi !== null && m.rsi > 70)
    .sort((a, b) => b.rsi! - a.rsi!);

  // ── Alertes déclenchées ─────────────────────────────────────────────────────
  type Triggered = {
    ticker: string;
    nom: string;
    price: number;
    kind: "achat" | "vente";
    seuil: number;
  };
  const triggered: Triggered[] = [];
  for (const a of alerts) {
    const s = snaps.get(a.ticker);
    if (!s) continue;
    if (a.seuil_bas && s.priceEur <= a.seuil_bas) {
      triggered.push({
        ticker: a.ticker, nom: a.nom, price: s.priceEur, kind: "achat", seuil: a.seuil_bas,
      });
    } else if (a.seuil_haut && s.priceEur >= a.seuil_haut) {
      triggered.push({
        ticker: a.ticker, nom: a.nom, price: s.priceEur, kind: "vente", seuil: a.seuil_haut,
      });
    }
  }

  // ── Heatmap ─────────────────────────────────────────────────────────────────
  const heatData = movers.map((m) => ({
    secteur: m.secteur,
    nom: m.nom,
    change: m.change,
  }));

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bonjour {user.name} — vue d&apos;ensemble du marché et de ton portefeuille.
        </p>
      </header>

      {portfolio.length > 0 && (
        <StatGrid>
          <StatCard label="Valeur du portefeuille" value={fmtEur(totalVal)} />
          <StatCard label="Montant investi" value={fmtEur(totalInvest)} />
          <StatCard
            label="P&L total"
            value={fmtEur(pnl)}
            delta={fmtPct(pnlPct)}
            deltaTone={pnl > 0 ? "gain" : pnl < 0 ? "loss" : "muted"}
          />
          <StatCard
            label="Positions"
            value={String(portfolio.length)}
            hint={unpriced ? `dont ${unpriced} sans cours` : undefined}
          />
        </StatGrid>
      )}

      {triggered.length > 0 && (
        <Card className="border-[var(--gain)]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4" />
              Alertes déclenchées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {triggered.map((t) => (
              <div key={t.ticker} className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {t.nom} <span className="text-muted-foreground">({t.ticker})</span>
                </span>
                <span
                  className={
                    t.kind === "achat" ? "text-[var(--gain)] tabular" : "text-[var(--loss)] tabular"
                  }
                >
                  {fmtEur(t.price)} {t.kind === "achat" ? "≤" : "≥"} {fmtEur(t.seuil)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MoverList title="Top hausses" icon="up" rows={topUp} />
        <MoverList title="Top baisses" icon="down" rows={topDown} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heatmap du marché</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap data={heatData} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Zone d&apos;achat{" "}
              <span className="font-normal text-muted-foreground">RSI &lt; 30</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rsiBuy.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune action en zone de survente.
              </p>
            ) : (
              <ul className="space-y-2">
                {rsiBuy.map((r) => (
                  <li key={r.ticker} className="flex items-center justify-between text-sm">
                    <span>{r.nom}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-muted-foreground">{fmtEur(r.price)}</span>
                      <RsiPill value={r.rsi} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Zone de vente{" "}
              <span className="font-normal text-muted-foreground">RSI &gt; 70</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rsiSell.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune action en zone de surachat.
              </p>
            ) : (
              <ul className="space-y-2">
                {rsiSell.map((r) => (
                  <li key={r.ticker} className="flex items-center justify-between text-sm">
                    <span>{r.nom}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-muted-foreground">{fmtEur(r.price)}</span>
                      <RsiPill value={r.rsi} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prochains résultats</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}
          >
            <EarningsList portfolioTickers={portfolio.map((p) => p.ticker)} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

function MoverList({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: "up" | "down";
  rows: { ticker: string; nom: string; price: number; change: number }[];
}) {
  const Icon = icon === "up" ? ArrowUp : ArrowDown;
  const tone = icon === "up" ? "text-[var(--gain)]" : "text-[var(--loss)]";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`size-4 ${tone}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.ticker} className="flex items-center justify-between text-sm">
              <span>
                {r.nom}{" "}
                <span className="text-xs text-muted-foreground">{r.ticker}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular text-muted-foreground">{fmtEur(r.price)}</span>
                <span className={`tabular font-medium ${pnlColor(r.change)}`}>
                  {fmtPct(r.change)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
    .slice(0, 10);

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Aucune date connue prochainement.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const w = WATCHLIST_BY_TICKER.get(r.ticker);
        const held = portfolioTickers.includes(r.ticker);
        return (
          <li key={r.ticker} className="flex items-center justify-between text-sm">
            <span>
              {w?.nom ?? r.ticker}
              {held && (
                <span className="ml-2 rounded bg-[var(--gain)]/15 px-1.5 py-0.5 text-xs text-[var(--gain)]">
                  en portefeuille
                </span>
              )}
            </span>
            <span className="tabular text-muted-foreground">
              {new Date(r.date).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
