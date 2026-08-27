# Stock Analyzer — Next.js

Analyse technique, suivi de portefeuille et alertes boursières. Réécriture de la
version Streamlit en Next.js 16 (App Router) + shadcn/ui, avec le même backend
Supabase et les mêmes comptes utilisateurs.

## Ce que fait l'app

| Page | Contenu |
|---|---|
| **Dashboard** | Valorisation du portefeuille, top hausses/baisses, heatmap sectorielle, opportunités RSI, alertes déclenchées, calendrier des résultats |
| **Screener** | Tous les titres suivis avec RSI, stochastique, croisement EMA et signal de consensus — triable et filtrable |
| **Analyse détaillée** | Chandeliers + EMA 20/50/200, Bollinger, volume, RSI, MACD, fondamentaux, actualités, et une lecture des indicateurs par Claude |
| **Comparaison** | Jusqu'à 5 titres en performance relative base 100 |
| **Portefeuille** | Positions et PRU, historique, import CSV courtier, métriques de risque (volatilité, Sharpe, drawdown, alpha vs S&P 500), journal d'investissement |
| **Backtesting** | Stratégies RSI / MACD / combinée contre le buy-and-hold |
| **Alertes** | Seuils d'achat et de vente par titre |
| **Paramètres** | Watchlist personnalisée, notifications Telegram, suppression des données |

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **shadcn/ui** + Tailwind CSS v4
- **Recharts** pour les graphiques
- **yahoo-finance2** pour les données de marché
- **Supabase** (PostgreSQL) pour les données utilisateur
- Indicateurs techniques calculés maison — portage vérifié des formules pandas
  de la version Streamlit (RSI, MACD, Bollinger, stochastique donnent des
  valeurs identiques à la décimale près)

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis remplis les trois variables
npm run dev
```

### Variables d'environnement

| Variable | Où la trouver | |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | requise |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → `service_role` | requise |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | requise |
| `ANTHROPIC_API_KEY` | console.anthropic.com | facultative |

Sans `ANTHROPIC_API_KEY`, tout fonctionne : seul le bouton d'analyse IA indique
que la fonctionnalité n'est pas configurée.

La clé `service_role` contourne RLS : elle ne doit jamais être exposée côté
client. Ici elle n'est lue que dans des modules marqués `server-only`, et
l'isolation entre comptes passe par un filtre `user_id` sur chaque requête.

### Base de données

Le schéma est identique à celui de la version Streamlit (`schema.sql` du dépôt
`stock-analyzer`) : tables `users`, `portfolio`, `transactions`, `alerts`,
`watchlist_custom`, `journal`, `telegram_config`, `rsi_state`. Les comptes et
données existants fonctionnent tels quels — `user_id` reste le nom
d'utilisateur, et les mots de passe bcrypt sont vérifiés à l'identique.

## Analyse IA

Sur la page d'analyse, un bouton demande à Claude de lire les indicateurs du
titre affiché. Le modèle ne reçoit que des valeurs déjà calculées par
l'application — cours, RSI, MACD, Bollinger, moyennes mobiles, fondamentaux,
titres de presse, et la position détenue le cas échéant. Il ne calcule rien
lui-même, ce qui rend sa lecture vérifiable ligne à ligne contre la page.

Le texte arrive en flux. Le prompt lui interdit d'émettre une recommandation
d'achat ou de vente et de donner un objectif de cours : il décrit ce que disent
les indicateurs, notamment là où ils divergent.

Chaque analyse est un appel facturé (`claude-opus-5`, de l'ordre de quelques
centimes) — elle ne part que sur clic, jamais au chargement de la page. Elle est
ensuite conservée six heures par titre et par période : recliquer ressert la
version existante, en indiquant son âge et le cours qui avait alors cours.
« Rafraîchir » force une nouvelle analyse.

Le cache vit dans une table Supabase à créer une fois :

```sql
-- contenu de sql/ai-analyses.sql, à coller dans Supabase → SQL Editor
```

Sans cette table, l'analyse fonctionne mais n'est jamais conservée — chaque clic
repaie un appel. Une fois la table en place, `node scripts/test-ai-cache.mjs`
vérifie le cache sans dépenser d'appel au modèle.

## Authentification

Session par cookie `httpOnly` signé HMAC-SHA256, valable 30 jours. Le cookie
n'est pas lisible en JavaScript, contrairement à la version Streamlit où le
jeton transitait par l'URL.

## Import CSV

Trois formats reconnus automatiquement :

- **Scalable Capital** — filtre les lignes `TRADING`, lit `BUY`/`SELL`
- **Degiro** (export français) — déduit le sens depuis le signe de la quantité
- **Générique** — colonnes `date, ticker, action, quantite, prix`

Les codes ISIN sont convertis en tickers Yahoo via l'API OpenFIGI, et chaque
ticker reste éditable avant l'import. Les transactions déjà enregistrées sont
détectées par empreinte (date + ticker + sens + quantité + prix) et ignorées,
donc réimporter le même relevé ne crée pas de doublons.

## Déploiement

Vercel : importer le dépôt, renseigner les trois variables d'environnement,
déployer. Aucune configuration supplémentaire.

---

> Outil d'aide à la décision. Les signaux techniques ne sont pas des conseils
> d'investissement.
