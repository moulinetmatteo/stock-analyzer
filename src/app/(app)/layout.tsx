import { redirect } from "next/navigation";
import { requireUser, clearSession } from "@/lib/auth";
import { getEurUsd } from "@/lib/market/quotes";
import { AppShell } from "@/components/app-shell";

async function logout() {
  "use server";
  await clearSession();
  redirect("/login");
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const eurusd = await getEurUsd();

  return (
    <AppShell name={user.name} eurusd={eurusd} onLogout={logout}>
      {children}
    </AppShell>
  );
}
