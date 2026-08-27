import { cn } from "@/lib/utils";
import type { SignalLevel } from "@/lib/market/indicators";

/**
 * Les signaux forts sont pleins, les signaux faibles en teinte douce : la force
 * du signal se lit au contraste, avant même de lire le texte.
 */
const STYLES: Record<SignalLevel, string> = {
  "ACHAT fort":
    "bg-[var(--gain)] text-[oklch(0.16_0.02_265)] font-semibold",
  "Achat possible":
    "bg-[var(--gain-soft)] text-[var(--gain)] ring-1 ring-inset ring-[var(--gain)]/25",
  Neutre: "bg-muted text-muted-foreground",
  "Vente possible":
    "bg-[var(--loss-soft)] text-[var(--loss)] ring-1 ring-inset ring-[var(--loss)]/25",
  "VENTE forte": "bg-[var(--loss)] text-[oklch(0.99_0_0)] font-semibold",
  "—": "bg-muted/60 text-muted-foreground",
};

export function SignalBadge({
  label,
  className,
}: {
  label: SignalLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs whitespace-nowrap",
        STYLES[label],
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * RSI avec une jauge sous le chiffre : la position dans la plage 0-100 se voit
 * d'un coup d'œil, sans avoir à interpréter la valeur.
 */
export function RsiPill({ value, gauge = false }: { value: number | null; gauge?: boolean }) {
  if (value === null || Number.isNaN(value)) {
    return <span className="text-muted-foreground">—</span>;
  }

  const tone =
    value < 30 ? "var(--gain)" : value > 70 ? "var(--loss)" : "var(--muted-foreground)";

  if (!gauge) {
    return (
      <span className="tabular font-medium" style={{ color: tone }}>
        {value.toFixed(1)}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="tabular font-medium" style={{ color: tone }}>
        {value.toFixed(1)}
      </span>
      <span className="relative block h-1 w-12 overflow-hidden rounded-full bg-muted">
        <span
          className="absolute top-0 bottom-0 w-[3px] rounded-full"
          style={{ left: `calc(${Math.min(Math.max(value, 0), 100)}% - 1.5px)`, backgroundColor: tone }}
        />
      </span>
    </span>
  );
}

/** Variation en pourcentage, avec triangle directionnel. */
export function DeltaText({
  value,
  className,
  showSign = true,
}: {
  value: number | null;
  className?: string;
  showSign?: boolean;
}) {
  if (value === null || Number.isNaN(value)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={cn("tabular font-medium", className)}
      style={{ color: flat ? "var(--muted-foreground)" : up ? "var(--gain)" : "var(--loss)" }}
    >
      {!flat && <span className="mr-0.5 text-[0.7em]">{up ? "▲" : "▼"}</span>}
      {showSign && up ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
