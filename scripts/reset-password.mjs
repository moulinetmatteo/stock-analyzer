/**
 * Réinitialise le mot de passe d'un compte directement en base.
 *
 *   node scripts/reset-password.mjs <utilisateur>
 *
 * Le mot de passe est saisi en masqué : il n'apparaît ni dans l'historique du
 * shell, ni dans la liste des processus. Le hash est produit avec bcrypt coût
 * 12, identique à ce qu'écrivent l'app Next et l'ancienne app Streamlit — les
 * deux resteront donc capables de vérifier le compte.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { createInterface } from "readline";
import { stdin, stdout } from "process";

const USER = process.argv[2];
if (!USER) {
  console.error("Usage : node scripts/reset-password.mjs <utilisateur>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean)
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/** Lecture masquée : on intercepte l'écho du terminal pendant la frappe. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const onData = (char) => {
      if (["\n", "\r", ""].includes(String(char))) {
        stdin.removeListener("data", onData);
      } else {
        stdout.write(`\x1b[2K\x1b[200D${question}`);
      }
    };
    stdout.write(question);
    stdin.on("data", onData);
    rl.question("", (value) => {
      rl.close();
      stdout.write("\n");
      resolve(value);
    });
  });
}

const { data: user, error: findErr } = await sb
  .from("users").select("username,name").eq("username", USER.toLowerCase().trim()).maybeSingle();

if (findErr) { console.error(`Base injoignable : ${findErr.message}`); process.exit(1); }
if (!user) { console.error(`Aucun compte "${USER}".`); process.exit(1); }

console.log(`Compte trouvé : ${user.username} (${user.name})\n`);

const pw = await askHidden("Nouveau mot de passe : ");
if (pw.length < 6) { console.error("\nMot de passe trop court (6 caractères min)."); process.exit(1); }
const confirm = await askHidden("Confirmer            : ");
if (pw !== confirm) { console.error("\nLes mots de passe ne correspondent pas."); process.exit(1); }

const { error } = await sb
  .from("users")
  .update({ password_hash: bcrypt.hashSync(pw, 12) })
  .eq("username", user.username);

if (error) { console.error(`\nÉchec de la mise à jour : ${error.message}`); process.exit(1); }
console.log(`\nMot de passe de ${user.username} réinitialisé.`);
