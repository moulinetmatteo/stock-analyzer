import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtEur(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  // Espace insécable avant le %, comme le veut la typographie française.
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}\u00a0%`;
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Capitalisation boursière en euros, format court (1,2 B€ / 340 Md€). */
export function fmtCap(val: number | null | undefined, eurusd = 1.08): string {
  if (!val) return "—";
  const v = val / eurusd;
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)} B€`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} Md€`;
  return `${(v / 1e6).toFixed(0)} M€`;
}

/** Classe Tailwind de couleur selon le signe (gain / perte). */
export function pnlColor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "text-muted-foreground";
  if (v > 0) return "text-[var(--gain)]";
  if (v < 0) return "text-[var(--loss)]";
  return "text-muted-foreground";
}
