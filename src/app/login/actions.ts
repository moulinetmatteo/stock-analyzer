"use server";

import { redirect } from "next/navigation";
import { login, register } from "@/lib/auth";

export type AuthState = { error?: string };

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const res = await login(
    String(formData.get("username") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!res.ok) return { error: res.error };
  redirect("/");
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const res = await register({
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!res.ok) return { error: res.error };
  redirect("/");
}
