import { cn } from "@/lib/utils";
import type { SignalLevel } from "@/lib/market/indicators";

const STYLES: Record<SignalLevel, string> = {
  "ACHAT fort": "bg-[var(--gain)]/15 text-[var(--gain)] ring-[var(--gain)]/30",
  "Achat possible": "bg-[var(--gain)]/10 text-[var(--gain)]/90 ring-[var(--gain)]/20",
  Neutre: "bg-muted text-muted-foreground ring-border",
  "Vente possible": "bg-[var(--loss)]/10 text-[var(--loss)]/90 ring-[var(--loss)]/20",
  "VENTE forte": "bg-[var(--loss)]/15 text-[var(--loss)] ring-[var(--loss)]/30",
  "—": "bg-muted text-muted-foreground ring-border",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        STYLES[label],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Pastille RSI colorée selon les zones de survente / surachat. */
export function RsiPill({ value }: { value: number | null }) {
  if (value === null || Number.isNaN(value)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const tone =
    value < 30
      ? "text-[var(--gain)]"
      : value > 70
        ? "text-[var(--loss)]"
        : "text-foreground";
  return <span className={cn("tabular font-medium", tone)}>{value.toFixed(1)}</span>;
}
