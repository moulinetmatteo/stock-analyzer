import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getUser()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Stock Analyzer</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Analyse technique, portefeuille et alertes
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
