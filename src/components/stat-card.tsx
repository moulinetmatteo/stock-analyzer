import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  deltaTone,
  hint,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "gain" | "loss" | "muted";
  hint?: string;
  className?: string;
}) {
  const tone =
    deltaTone === "gain"
      ? "text-[var(--gain)]"
      : deltaTone === "loss"
        ? "text-[var(--loss)]"
        : "text-muted-foreground";

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular tracking-tight">{value}</p>
      {delta && <p className={cn("mt-0.5 text-sm tabular", tone)}>{delta}</p>}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}
