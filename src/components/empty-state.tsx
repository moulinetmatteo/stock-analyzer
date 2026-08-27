import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * État vide : une icône, ce qui manque, et quoi faire pour le remplir. Un cadre
 * pointillé seul laisse l'utilisateur deviner s'il s'agit d'un vide normal ou
 * d'une erreur.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <span className="bg-muted/60 text-muted-foreground mb-3 flex size-10 items-center justify-center rounded-full">
        <Icon className="size-[1.15rem]" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
