# 📈 Stock Analyzer

Application d'analyse boursière personnelle, construite avec Streamlit et Python.

## Fonctionnalités

- **Dashboard** — Vue d'ensemble : valeur du portefeuille, top mouvements du jour, opportunités RSI, calendrier des résultats d'entreprises
- **Screener** — Tableau de toute la watchlist avec RSI, Stochastique, Golden/Death Cross et signal d'achat/vente
- **Analyse détaillée** — Graphique interactif avec Bollinger, EMA, Volume, Stochastique, MACD, RSI + données fondamentales (P/E, dividende, capitalisation, beta) + actualités récentes
- **Mon Portefeuille** — Suivi des positions, historique des transactions, camembert d'allocation, courbe de valeur, métriques de risque (Sharpe, drawdown, volatilité, vs S&P 500)
- **Backtesting** — Simulation de 3 stratégies sur données historiques (RSI seul, MACD seul, RSI+MACD) avec equity curve vs buy-and-hold
- **Alertes** — Seuils de prix personnalisés avec notifications Telegram et macOS
- **Watchlist personnalisable** — Ajout de n'importe quel ticker Yahoo Finance
- **Vérification automatique** — Cron toutes les 30 min (9h–18h, lun–ven) pour les alertes prix + scan RSI matinal

## Stack

- [Streamlit](https://streamlit.io/) — interface web
- [yfinance](https://github.com/ranaroussi/yfinance) — données de marché
- [Plotly](https://plotly.com/python/) — graphiques interactifs
- [pandas](https://pandas.pydata.org/) — calcul des indicateurs techniques

## Installation

```bash
git clone https://github.com/moulinetmatteo/stock-analyzer.git
cd stock-analyzer
pip install -r requirements.txt
```

## Lancement

```bash
python3 -m streamlit run app.py
```

Ou double-clique sur **Stock Analyzer.command** dans le Finder (macOS).

## Notifications Telegram

1. Ouvre Telegram → **@BotFather** → `/newbot` → copie le token
2. Ouvre **@userinfobot** → `/start` → copie ton Chat ID
3. Dans l'app → **Paramètres** → colle le token et le Chat ID → Tester

## Vérification automatique (cron)

```bash
chmod +x install_cron.sh
./install_cron.sh
```

Installe deux tâches planifiées :
- Alertes prix toutes les 30 min, 9h–18h, lun–ven
- Scan des opportunités RSI chaque matin à 9h30, lun–ven

## Indicateurs techniques

| Indicateur | Signal achat | Signal vente |
|---|---|---|
| RSI (14) | < 30 | > 70 |
| Stochastique | < 20 | > 80 |
| MACD | Croisement haussier | Croisement baissier |
| Bollinger | Prix sur bande basse | Prix sur bande haute |
| Golden/Death Cross | EMA50 > EMA200 | EMA50 < EMA200 |

> ⚠️ Outil d'aide à la décision uniquement. Ne constitue pas un conseil en investissement.
