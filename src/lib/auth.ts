import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { supabase } from "./supabase/server";

const COOKIE = "sa_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET manquant ou trop court (32 caractères min). " +
        "Sur Vercel : Settings → Environment Variables, portée Production, puis redéployer.",
    );
  }
  return s;
}

/** Diagnostic de configuration, sans jamais exposer les valeurs. */
export async function checkConfig(): Promise<{ ok: boolean; problems: string[] }> {
  const problems: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) problems.push("NEXT_PUBLIC_SUPABASE_URL absente");
  if (!process.env.SUPABASE_SERVICE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    problems.push("SUPABASE_SERVICE_KEY absente");
  }
  const s = process.env.SESSION_SECRET;
  if (!s) problems.push("SESSION_SECRET absente");
  else if (s.length < 16) problems.push("SESSION_SECRET trop courte");

  if (!problems.length) {
    const { error } = await supabase.from("users").select("username").limit(1);
    if (error) problems.push(`Supabase refuse la requête : ${error.message}`);
  }

  return { ok: problems.length === 0, problems };
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Jeton `username.expiry.signature`, signé HMAC et daté. */
function makeToken(username: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${username}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, exp, sig] = parts;
  const expected = sign(`${username}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now()) return null;
  return username;
}

export type SessionUser = { username: string; name: string };

/** Utilisateur connecté, ou null. À appeler depuis un Server Component. */
export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const username = verifyToken(token);
  if (!username) return null;

  const { data } = await supabase
    .from("users")
    .select("username,name")
    .eq("username", username)
    .maybeSingle();

  return data ? { username: data.username, name: data.name ?? data.username } : null;
}

/** Comme getUser, mais redirige vers /login si non connecté. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function setSession(username: string) {
  const jar = await cookies();
  jar.set(COOKIE, makeToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const u = username.toLowerCase().trim();
  if (!u || !password) return { ok: false, error: "Remplis tous les champs." };

  const { data, error } = await supabase
    .from("users")
    .select("username,name,password_hash")
    .eq("username", u)
    .maybeSingle();

  // Une base injoignable ne doit pas se confondre avec de mauvais identifiants :
  // sinon une clé Supabase absente en production ressemble à une faute de frappe.
  if (error) {
    console.error("[auth] requête users échouée:", error.message);
    return { ok: false, error: "Base de données injoignable — vérifie la configuration du serveur." };
  }

  if (!data) return { ok: false, error: "Identifiants incorrects." };

  const valid = await bcrypt.compare(password, data.password_hash);
  if (!valid) return { ok: false, error: "Identifiants incorrects." };

  await setSession(data.username);
  return { ok: true };
}

export async function register(input: {
  username: string;
  email: string;
  name: string;
  password: string;
  confirm: string;
}): Promise<{ ok: boolean; error?: string }> {
  const u = input.username.toLowerCase().trim();
  if (!u || !input.password) return { ok: false, error: "Remplis tous les champs obligatoires." };
  if (!/^[a-z0-9_-]{3,32}$/.test(u)) {
    return { ok: false, error: "Nom d'utilisateur : 3-32 caractères (lettres, chiffres, - _)." };
  }
  if (input.password !== input.confirm) {
    return { ok: false, error: "Les mots de passe ne correspondent pas." };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Mot de passe trop court (6 caractères min)." };
  }

  const { data: existing } = await supabase
    .from("users")
    .select("username")
    .eq("username", u)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ce nom d'utilisateur est déjà pris." };

  const hash = await bcrypt.hash(input.password, 12);
  const { error } = await supabase.from("users").insert({
    username: u,
    email: input.email.trim(),
    name: input.name.trim() || u,
    password_hash: hash,
  });
  if (error) return { ok: false, error: `Erreur : ${error.message}` };

  await setSession(u);
  return { ok: true };
}

export function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}
