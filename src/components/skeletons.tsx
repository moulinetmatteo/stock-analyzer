import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Les squelettes reprennent la géométrie du contenu réel — même hauteur de
 * carte, même nombre de lignes — pour que rien ne saute au moment du rendu.
 */

export function HeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      {withActions && <Skeleton className="h-9 w-64" />}
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card space-y-2.5 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ListCardSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("surface-card p-5", className)}>
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartCardSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div className="surface-card p-5">
      <Skeleton className="mb-4 h-4 w-44" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

export function TableSkeleton({ rows = 12, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex gap-4 border-b px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "w-28" : "flex-1")} />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "w-28" : "flex-1")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeatmapSkeleton() {
  return (
    <div className="surface-card space-y-5 p-5">
      <Skeleton className="h-4 w-44" />
      {[13, 5, 6].map((n, s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: n }).map((_, i) => (
              <Skeleton key={i} className="h-[3.25rem]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
