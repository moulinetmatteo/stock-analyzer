import {
  HeaderSkeleton, StatGridSkeleton, ListCardSkeleton, HeatmapSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-7">
      <HeaderSkeleton />
      <StatGridSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCardSkeleton />
        <ListCardSkeleton />
      </div>
      <HeatmapSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCardSkeleton rows={3} />
        <ListCardSkeleton rows={3} />
      </div>
    </div>
  );
}
