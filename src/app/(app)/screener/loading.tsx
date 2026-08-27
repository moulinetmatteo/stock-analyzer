import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withActions />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-[22rem]" />
      </div>
      <TableSkeleton rows={14} />
    </div>
  );
}
