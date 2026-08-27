"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Cell = { secteur: string; nom: string; ticker: string; change: number };

/** Ordre stable des secteurs, sinon il suit l'ordre de tri des données. */
const ORDER = ["US Tech", "US Finance", "US Santé", "US Énergie", "France", "ETF"];

/**
 * Intensité saturée à ±2,5 % : au-delà, tout le marché paraîtrait au maximum
 * les jours de forte volatilité et la nuance disparaîtrait.
 */
function tone(change: number) {
  const mag = Math.min(Math.abs(change) / 2.5, 1);
  const color = change >= 0 ? "var(--gain)" : "var(--loss)";
  return {
    background: `color-mix(in oklch, ${color} ${(8 + mag * 40).toFixed(0)}%, var(--card))`,
    borderColor: `color-mix(in oklch, ${color} ${(14 + mag * 30).toFixed(0)}%, transparent)`,
  };
}

export function Heatmap({ data }: { data: Cell[] }) {
  const bySector = data.reduce<Record<string, Cell[]>>((acc, c) => {
    (acc[c.secteur] ??= []).push(c);
    return acc;
  }, {});

  const sectors = Object.keys(bySector).sort(
    (a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99),
  );

  return (
    <div className="space-y-5">
      {sectors.map((secteur) => {
        const cells = [...bySector[secteur]].sort((a, b) => b.change - a.change);
        const avg = cells.reduce((s, c) => s + c.change, 0) / cells.length;

        return (
          <section key={secteur}>
            <div className="mb-2 flex items-baseline gap-2.5">
              <h3 className="label-eyebrow">{secteur}</h3>
              <span
                className="tabular text-[0.7rem] font-medium"
                style={{ color: avg >= 0 ? "var(--gain)" : "var(--loss)" }}
              >
                {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
              </span>
              <span className="bg-border h-px flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
              {cells.map((c) => (
                <Link
                  key={c.ticker}
                  href={`/analyse?ticker=${encodeURIComponent(c.ticker)}`}
                  style={tone(c.change)}
                  className={cn(
                    "rounded-md border px-2.5 py-2 transition-transform",
                    "hover:z-10 hover:scale-[1.03]",
                  )}
                >
                  <p className="truncate text-xs font-medium">{c.nom}</p>
                  <p
                    className="tabular mt-0.5 text-sm font-semibold"
                    style={{ color: c.change >= 0 ? "var(--gain)" : "var(--loss)" }}
                  >
                    {c.change >= 0 ? "+" : ""}{c.change.toFixed(2)}%
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
