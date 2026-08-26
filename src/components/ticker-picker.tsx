"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function TickerPicker({
  universe,
  current,
  paramName = "ticker",
}: {
  universe: { nom: string; ticker: string }[];
  current: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(ticker: string) {
    const next = new URLSearchParams(params.toString());
    next.set(paramName, ticker);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Select value={current} onValueChange={select}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Choisir une action" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {universe.map((u) => (
          <SelectItem key={u.ticker} value={u.ticker}>
            {u.nom}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
