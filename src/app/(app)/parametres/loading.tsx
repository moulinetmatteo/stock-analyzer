import { HeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <HeaderSkeleton />
      {[150, 260, 210].map((h, i) => (
        <Skeleton key={i} className="w-full" style={{ height: h }} />
      ))}
    </div>
  );
}
