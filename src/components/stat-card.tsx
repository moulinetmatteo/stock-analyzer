import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "gain" | "loss" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  gain: "text-[var(--gain)]",
  loss: "text-[var(--loss)]",
  muted: "text-muted-foreground",
};

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "muted",
  hint,
  size = "md",
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: Tone;
  hint?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const Arrow = deltaTone === "gain" ? ArrowUp : deltaTone === "loss" ? ArrowDown : null;

  return (
    <div className={cn("surface-card p-4", className)}>
      <p className="label-eyebrow">{label}</p>
      <p className={cn("mt-2", size === "lg" ? "metric-lg" : "metric")}>{value}</p>

      {delta && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-sm tabular font-medium", TONE_TEXT[deltaTone])}>
          {Arrow && <Arrow className="size-3.5" strokeWidth={2.5} />}
          {delta}
        </p>
      )}

      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** En-tête de page : titre, sous-titre, et actions alignées à droite. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="min-w-0">
        <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Titre de section, plus léger qu'un en-tête de page. */
export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}
