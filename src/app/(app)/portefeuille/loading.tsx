import { HeaderSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <Skeleton className="h-9 w-80" />
      <StatGridSkeleton />
      <TableSkeleton rows={8} cols={9} />
    </div>
  );
}
