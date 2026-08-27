"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "technique", label: "Technique", icon: Activity, hint: "signaux de timing" },
  { id: "fondamental", label: "Fondamental", icon: Building2, hint: "qualité des entreprises" },
] as const;

/**
 * Les deux vues répondent à des questions différentes — quand entrer, et quoi
 * acheter. Les séparer explicitement vaut mieux que de mélanger RSI et marges
 * dans un même tableau.
 */
export function ViewSwitch({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(vue: string) {
    const next = new URLSearchParams(params.toString());
    next.set("vue", vue);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-md border p-0.5">
      {VIEWS.map(({ id, label, icon: Icon, hint }) => (
        <button
          key={id}
          onClick={() => select(id)}
          title={hint}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
            current === id
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
