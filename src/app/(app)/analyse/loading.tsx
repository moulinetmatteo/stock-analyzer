import { HeaderSkeleton, ChartCardSkeleton, ListCardSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withActions />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="surface-card space-y-2.5 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <ChartCardSkeleton height={560} />
      <ListCardSkeleton rows={3} />
    </div>
  );
}
