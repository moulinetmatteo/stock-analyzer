"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Filter, LineChart, GitCompare,
  Wallet, FlaskConical, Bell, Settings, LogOut, TrendingUp, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const GROUPS: {
  label: string;
  items: { href: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    label: "Marché",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/screener", label: "Screener", icon: Filter },
      { href: "/analyse", label: "Analyse", icon: LineChart },
      { href: "/candidats", label: "Candidats", icon: Eye },
      { href: "/comparaison", label: "Comparaison", icon: GitCompare },
    ],
  },
  {
    label: "Mes positions",
    items: [
      { href: "/portefeuille", label: "Portefeuille", icon: Wallet },
      { href: "/backtesting", label: "Backtesting", icon: FlaskConical },
      { href: "/alertes", label: "Alertes", icon: Bell },
    ],
  },
];

export function NavSidebar({
  name,
  eurusd,
  onLogout,
  onNavigate,
}: {
  name: string;
  eurusd: number;
  onLogout: () => void;
  /** Referme le tiroir mobile après un clic. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const itemClass = (active: boolean) =>
    cn(
      "group relative flex items-center gap-2.5 rounded-md px-3 py-[0.4rem] text-sm transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground",
    );

  return (
    <div className="bg-sidebar flex h-full w-full flex-col">
      <div className="px-4 py-5">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-lg">
            <TrendingUp className="size-4" strokeWidth={2.5} />
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight">
            Stock Analyzer
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="label-eyebrow px-3 pb-1.5">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link href={href} onClick={onNavigate} className={itemClass(active)}>
                      {/* Le liseré marque la page courante sans alourdir l'item. */}
                      {active && (
                        <span className="bg-primary absolute top-1/2 -left-3 h-4 w-[3px] -translate-y-1/2 rounded-r-full" />
                      )}
                      <Icon
                        className={cn("size-4 shrink-0", active ? "text-primary" : "opacity-70")}
                        strokeWidth={2}
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border space-y-2 border-t p-3">
        <div className="flex items-center justify-between px-2 text-xs">
          <span className="text-muted-foreground">EUR / USD</span>
          <span className="tabular font-medium">{eurusd.toFixed(4)}</span>
        </div>

        <Link
          href="/parametres"
          onClick={onNavigate}
          className={itemClass(isActive("/parametres"))}
        >
          <Settings
            className={cn("size-4", isActive("/parametres") ? "text-primary" : "opacity-70")}
          />
          Paramètres
        </Link>

        <div className="flex items-center gap-2 px-2 pt-1">
          <span className="bg-primary/12 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
          <form action={onLogout}>
            <button
              type="submit"
              aria-label="Se déconnecter"
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-md p-1.5 transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>

        <div className="px-2 pt-1">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
