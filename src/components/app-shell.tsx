"use client";

import { useState } from "react";
import { Menu, TrendingUp } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavSidebar } from "@/components/nav-sidebar";

/**
 * Coquille de l'application. La navigation est fixe à partir de `md`, et passe
 * dans un tiroir en dessous, où une barre latérale figée mangerait l'écran.
 */
export function AppShell({
  name,
  eurusd,
  onLogout,
  children,
}: {
  name: string;
  eurusd: number;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="border-sidebar-border hidden w-[15rem] shrink-0 border-r md:block">
        <div className="sticky top-0 h-screen">
          <NavSidebar name={name} eurusd={eurusd} onLogout={onLogout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-2.5 backdrop-blur md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Ouvrir la navigation"
              className="hover:bg-accent rounded-md p-1.5 transition-colors"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[15rem] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <NavSidebar
                name={name}
                eurusd={eurusd}
                onLogout={onLogout}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <span className="flex items-center gap-2">
            <TrendingUp className="text-primary size-4" strokeWidth={2.5} />
            <span className="text-sm font-semibold tracking-tight">Stock Analyzer</span>
          </span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
