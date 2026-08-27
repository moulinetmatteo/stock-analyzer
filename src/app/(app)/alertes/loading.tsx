import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <Skeleton className="h-9 w-40" />
      <TableSkeleton rows={4} cols={7} />
    </div>
  );
}
