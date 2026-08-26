"use client";

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/utils";

type Cell = { secteur: string; nom: string; change: number };

/**
 * Intensité de fond proportionnelle à la variation, saturée à ±3 % pour que les
 * mouvements ordinaires restent lisibles au lieu d'être tous au maximum.
 */
function tone(change: number): string {
  const mag = Math.min(Math.abs(change) / 3, 1);
  const alpha = 0.1 + mag * 0.45;
  const color = change >= 0 ? "var(--gain)" : "var(--loss)";
  return `color-mix(in oklch, ${color} ${(alpha * 100).toFixed(0)}%, transparent)`;
}

export function Heatmap({ data }: { data: Cell[] }) {
  const bySector = data.reduce<Record<string, Cell[]>>((acc, c) => {
    (acc[c.secteur] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(bySector).map(([secteur, cells]) => (
        <section key={secteur}>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {secteur}
          </h3>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
            {cells
              .sort((a, b) => b.change - a.change)
              .map((c) => (
                <div
                  key={c.nom}
                  style={{ backgroundColor: tone(c.change) }}
                  className="rounded-md border px-2.5 py-2"
                  title={`${c.nom} · ${fmtPct(c.change)}`}
                >
                  <p className="truncate text-xs font-medium">{c.nom}</p>
                  <p
                    className={cn(
                      "tabular text-sm font-semibold",
                      c.change >= 0 ? "text-[var(--gain)]" : "text-[var(--loss)]",
                    )}
                  >
                    {fmtPct(c.change)}
                  </p>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
