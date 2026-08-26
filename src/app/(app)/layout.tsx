import { requireUser, clearSession } from "@/lib/auth";
import { getEurUsd } from "@/lib/market/quotes";
import { NavSidebar } from "@/components/nav-sidebar";
import { redirect } from "next/navigation";

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
    <div className="flex min-h-screen">
      <NavSidebar name={user.name} eurusd={eurusd} onLogout={logout} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-8 py-7">{children}</main>
    </div>
  );
}
