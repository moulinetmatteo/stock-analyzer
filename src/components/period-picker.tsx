"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODS, type PeriodKey } from "@/lib/market/constants";
import { cn } from "@/lib/utils";

export function PeriodPicker({ current }: { current: PeriodKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(p: PeriodKey) {
    const next = new URLSearchParams(params.toString());
    next.set("periode", p);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-md border p-0.5">
      {(Object.keys(PERIODS) as PeriodKey[]).map((p) => (
        <button
          key={p}
          onClick={() => select(p)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            p === current
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {PERIODS[p].label}
        </button>
      ))}
    </div>
  );
}
