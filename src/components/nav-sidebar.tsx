"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Filter, LineChart, GitCompare,
  Wallet, FlaskConical, Bell, Settings, LogOut, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/analyse", label: "Analyse détaillée", icon: LineChart },
  { href: "/comparaison", label: "Comparaison", icon: GitCompare },
  { href: "/portefeuille", label: "Mon Portefeuille", icon: Wallet },
  { href: "/backtesting", label: "Backtesting", icon: FlaskConical },
  { href: "/alertes", label: "Alertes", icon: Bell },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export function NavSidebar({
  name,
  eurusd,
  onLogout,
}: {
  name: string;
  eurusd: number;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="border-b px-5 py-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-[var(--gain)]" />
          <span className="font-semibold tracking-tight">Stock Analyzer</span>
        </div>
        <p className="mt-3 text-sm text-sidebar-foreground/70">{name}</p>
        <p className="text-xs tabular text-muted-foreground">
          1 € = {eurusd.toFixed(4)} $
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <form action={onLogout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-sidebar-foreground/70"
          >
            <LogOut className="size-4" />
            Déconnexion
          </Button>
        </form>
      </div>
    </aside>
  );
}
