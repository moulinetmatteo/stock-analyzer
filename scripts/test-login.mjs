/**
 * Teste le cycle de connexion complet : création d'un compte jetable, login avec
 * le bon mot de passe, persistance de session, déconnexion, puis suppression du
 * compte. C'est le seul chemin que les suites e2e ne couvrent pas, puisqu'elles
 * forgent le cookie de session au lieu de passer par le formulaire.
 *
 *   node scripts/test-login.mjs        # contre http://localhost:3000
 *   BASE=https://mon-app.vercel.app node scripts/test-login.mjs
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';

const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(Boolean)
  .map(l => { const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {auth:{persistSession:false}});

const U = 'zz-test-' + Math.random().toString(36).slice(2,8);
const P = 'MotDePasseTest!' + Math.random().toString(36).slice(2,6);
let browser;

try {
  // Hash généré par la lib Python, comme les comptes existants
  const hash = bcrypt.hashSync(P, 12);
  const { error } = await sb.from('users').insert({username:U, email:`${U}@test.local`, name:'Test', password_hash:hash});
  if (error) throw new Error('création: ' + error.message);
  console.log(`compte jetable créé : ${U}`);

  browser = await chromium.launch();
  const p = await (await browser.newContext()).newPage();

  await p.goto(`${BASE}/login`, {waitUntil:'networkidle'});
  await p.fill('input[name="username"]', U);
  await p.fill('input[name="password"]', P);
  const t0 = Date.now();
  await p.click('button[type="submit"]');
  let navigated = true;
  try { await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 45000 }); }
  catch { navigated = false; }
  const ms = Date.now() - t0;
  const body = await p.textContent('body');
  console.log(`connexion réussie   : ${navigated && body.includes('Dashboard') ? 'OUI' : 'NON'}  (${(ms/1000).toFixed(1)}s, url: ${p.url().replace(BASE, '') || '/'})`);
  if (!navigated) console.log(`   message: ${(body.match(/Identifiants incorrects|Base de données injoignable/i)||['aucun message'])[0]}`);

  // Le cookie survit-il à un rechargement ?
  await p.reload({waitUntil:'networkidle'});
  const stillIn = !p.url().includes('/login');
  console.log(`session persistante : ${stillIn ? 'OUI' : 'NON'}`);

  // Déconnexion
  await p.click('button:has-text("Déconnexion")');
  await p.waitForTimeout(2500);
  console.log(`déconnexion         : ${p.url().includes('/login') ? 'OUI' : 'NON'}`);
} catch (e) {
  console.error('ÉCHEC:', e.message);
} finally {
  if (browser) await browser.close();
  const { error } = await sb.from('users').delete().eq('username', U);
  console.log(error ? `NETTOYAGE ÉCHOUÉ pour ${U}: ${error.message}` : `compte jetable supprimé`);
}
