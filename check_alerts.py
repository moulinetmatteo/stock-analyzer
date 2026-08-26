#!/usr/bin/env python3
"""Vérifie les alertes prix ET les alertes RSI automatiques, envoie Telegram + notif Mac."""
import json
import subprocess
import sys
import urllib.request
import urllib.parse
import warnings
from datetime import date
from pathlib import Path

warnings.filterwarnings("ignore", category=FutureWarning)
import urllib3
urllib3.disable_warnings()
import yfinance as yf
import pandas as pd

DIR = Path(__file__).parent
ALERTS_FILE = DIR / "alerts.json"
TELEGRAM_FILE = DIR / "telegram_config.json"
RSI_STATE_FILE = DIR / "rsi_state.json"

WATCHLIST = {
    "Apple": "AAPL", "Microsoft": "MSFT", "Google": "GOOGL", "Amazon": "AMZN",
    "NVIDIA": "NVDA", "Tesla": "TSLA", "Meta": "META", "Netflix": "NFLX",
    "AMD": "AMD", "Intel": "INTC", "Oracle": "ORCL", "Salesforce": "CRM",
    "Adobe": "ADBE", "JPMorgan": "JPM", "Bank of America": "BAC",
    "Goldman Sachs": "GS", "Visa": "V", "Mastercard": "MA",
    "Johnson & Johnson": "JNJ", "Pfizer": "PFE", "UnitedHealth": "UNH",
    "ExxonMobil": "XOM", "Chevron": "CVX",
    "LVMH": "MC.PA", "TotalEnergies": "TTE.PA", "Airbus": "AIR.PA",
    "Sanofi": "SAN.PA", "BNP Paribas": "BNP.PA", "L'Oréal": "OR.PA",
    "Schneider": "SU.PA", "Capgemini": "CAP.PA", "Hermès": "RMS.PA",
    "Kering": "KER.PA", "S&P 500": "SPY", "Nasdaq 100": "QQQ",
    "MSCI World": "IWDA.AS", "Total US Market": "VTI",
}

TICKER_CURRENCY = {
    "AAPL": "USD", "MSFT": "USD", "GOOGL": "USD", "AMZN": "USD", "NVDA": "USD",
    "TSLA": "USD", "META": "USD", "NFLX": "USD", "AMD": "USD", "INTC": "USD",
    "ORCL": "USD", "CRM": "USD", "ADBE": "USD", "JPM": "USD", "BAC": "USD",
    "GS": "USD", "V": "USD", "MA": "USD", "JNJ": "USD", "PFE": "USD",
    "UNH": "USD", "XOM": "USD", "CVX": "USD",
    "SPY": "USD", "QQQ": "USD", "VTI": "USD", "IWDA.AS": "USD", "CSPX.AS": "USD",
    "MC.PA": "EUR", "TTE.PA": "EUR", "AIR.PA": "EUR", "SAN.PA": "EUR",
    "BNP.PA": "EUR", "OR.PA": "EUR", "SU.PA": "EUR", "CAP.PA": "EUR",
    "RMS.PA": "EUR", "KER.PA": "EUR",
}


def last_close(df) -> float:
    val = df["Close"].iat[-1]
    return float(val.item()) if hasattr(val, "item") else float(val)


def get_eurusd() -> float:
    try:
        df = yf.download("EURUSD=X", period="5d", auto_adjust=True, progress=False)
        if not df.empty:
            df.columns = df.columns.get_level_values(0)
            return last_close(df)
    except Exception:
        pass
    return 1.08


def to_eur(price: float, ticker: str, eurusd: float) -> float:
    return price if TICKER_CURRENCY.get(ticker, "USD") == "EUR" else price / eurusd


def compute_rsi(close: pd.Series, length: int = 14) -> float:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(com=length - 1, min_periods=length).mean()
    loss = (-delta.clip(upper=0)).ewm(com=length - 1, min_periods=length).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iat[-1]
    return float(val.item()) if hasattr(val, "item") else float(val)


def send_telegram(token: str, chat_id: str, text: str):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=10)


def mac_notify(title: str, message: str):
    script = f'display notification "{message}" with title "{title}" sound name "Glass"'
    subprocess.run(["osascript", "-e", script], check=False)


def check_price_alerts(eurusd, tg_ok, tg):
    """Alertes sur seuils de prix définis manuellement."""
    if not ALERTS_FILE.exists():
        return
    alerts = json.loads(ALERTS_FILE.read_text())
    for ticker, alert in alerts.items():
        try:
            df = yf.download(ticker, period="5d", auto_adjust=True, progress=False)
            if df.empty:
                continue
            df.columns = df.columns.get_level_values(0)
            price_eur = to_eur(last_close(df), ticker, eurusd)
            nom = alert.get("nom", ticker)

            if alert.get("seuil_bas") and price_eur <= alert["seuil_bas"]:
                msg = (f"🟢 <b>Alerte ACHAT — {nom}</b>\n"
                       f"Prix : <b>{price_eur:.2f} €</b> ≤ seuil {alert['seuil_bas']:.2f} €")
                if tg_ok:
                    send_telegram(tg["token"], tg["chat_id"], msg)
                mac_notify(f"📈 Alerte ACHAT — {nom}", f"{price_eur:.2f} € ≤ {alert['seuil_bas']:.2f} €")
                print(f"✅ Alerte prix ACHAT : {nom}")

            if alert.get("seuil_haut") and price_eur >= alert["seuil_haut"]:
                msg = (f"🔴 <b>Alerte VENTE — {nom}</b>\n"
                       f"Prix : <b>{price_eur:.2f} €</b> ≥ seuil {alert['seuil_haut']:.2f} €")
                if tg_ok:
                    send_telegram(tg["token"], tg["chat_id"], msg)
                mac_notify(f"📉 Alerte VENTE — {nom}", f"{price_eur:.2f} € ≥ {alert['seuil_haut']:.2f} €")
                print(f"✅ Alerte prix VENTE : {nom}")
        except Exception as e:
            print(f"Erreur alerte prix {ticker}: {e}")


def check_rsi_alerts(eurusd, tg_ok, tg):
    """Alertes RSI automatiques : notifie uniquement lors du passage en zone (pas en continu)."""
    state = json.loads(RSI_STATE_FILE.read_text()) if RSI_STATE_FILE.exists() else {}
    today = str(date.today())
    rsi_msgs_buy = []
    rsi_msgs_sell = []

    for nom, ticker in WATCHLIST.items():
        try:
            df = yf.download(ticker, period="3mo", auto_adjust=True, progress=False)
            if df.empty or len(df) < 20:
                continue
            df.columns = df.columns.get_level_values(0)
            rsi = compute_rsi(df["Close"])
            price_eur = to_eur(last_close(df), ticker, eurusd)

            prev = state.get(ticker, {"zone": "neutral", "alerted_date": ""})
            prev_zone = prev.get("zone", "neutral")

            if rsi < 30:
                new_zone = "buy"
            elif rsi > 70:
                new_zone = "sell"
            else:
                new_zone = "neutral"

            # Alerte seulement si la zone CHANGE (entrée dans la zone)
            alerted_today = prev.get("alerted_date") == today
            if new_zone != prev_zone and not alerted_today:
                if new_zone == "buy":
                    rsi_msgs_buy.append(f"  • <b>{nom}</b> ({ticker}) — {price_eur:.2f} € · RSI {rsi:.1f}")
                    print(f"✅ RSI ACHAT détecté : {nom} (RSI {rsi:.1f})")
                elif new_zone == "sell":
                    rsi_msgs_sell.append(f"  • <b>{nom}</b> ({ticker}) — {price_eur:.2f} € · RSI {rsi:.1f}")
                    print(f"✅ RSI VENTE détecté : {nom} (RSI {rsi:.1f})")

            state[ticker] = {"zone": new_zone, "alerted_date": today if new_zone != "neutral" and new_zone != prev_zone else prev.get("alerted_date", "")}

        except Exception as e:
            print(f"Erreur RSI {ticker}: {e}")

    # Sauvegarde de l'état
    RSI_STATE_FILE.write_text(json.dumps(state, indent=2))

    # Envoi groupé
    if rsi_msgs_buy or rsi_msgs_sell:
        lines = ["📊 <b>Alerte RSI — Nouvelles zones détectées</b>\n"]
        if rsi_msgs_buy:
            lines.append("🟢 <b>En zone d'ACHAT</b> (RSI vient de passer sous 30)")
            lines.extend(rsi_msgs_buy)
        if rsi_msgs_sell:
            lines.append("\n🔴 <b>En zone de VENTE</b> (RSI vient de passer sur 70)")
            lines.extend(rsi_msgs_sell)
        msg = "\n".join(lines)
        if tg_ok:
            send_telegram(tg["token"], tg["chat_id"], msg)
        total = len(rsi_msgs_buy) + len(rsi_msgs_sell)
        mac_notify("📊 Alerte RSI", f"{total} action(s) en nouvelle zone")
    else:
        print("Aucune nouvelle zone RSI détectée.")


def main():
    tg = json.loads(TELEGRAM_FILE.read_text()) if TELEGRAM_FILE.exists() else {}
    tg_ok = bool(tg.get("token") and tg.get("chat_id"))
    eurusd = get_eurusd()

    print("── Alertes prix ──")
    check_price_alerts(eurusd, tg_ok, tg)

    print("── Alertes RSI ──")
    check_rsi_alerts(eurusd, tg_ok, tg)


if __name__ == "__main__":
    main()
