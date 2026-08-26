#!/usr/bin/env python3
"""Scan matinal : opportunités d'achat RSI+MACD pour tous les utilisateurs."""
import os
import urllib.request
import urllib.parse
import warnings

warnings.filterwarnings("ignore")
import urllib3
urllib3.disable_warnings()
import yfinance as yf
import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

TICKER_CURRENCY = {
    "AAPL": "USD", "MSFT": "USD", "GOOGL": "USD", "AMZN": "USD", "NVDA": "USD",
    "TSLA": "USD", "META": "USD", "NFLX": "USD", "AMD": "USD", "INTC": "USD",
    "ORCL": "USD", "CRM": "USD", "ADBE": "USD", "JPM": "USD", "BAC": "USD",
    "GS": "USD", "V": "USD", "MA": "USD", "JNJ": "USD", "PFE": "USD",
    "UNH": "USD", "XOM": "USD", "CVX": "USD",
    "SPY": "USD", "QQQ": "USD", "VTI": "USD", "IWDA.AS": "USD",
    "MC.PA": "EUR", "TTE.PA": "EUR", "AIR.PA": "EUR", "SAN.PA": "EUR",
    "BNP.PA": "EUR", "OR.PA": "EUR", "SU.PA": "EUR", "CAP.PA": "EUR",
    "RMS.PA": "EUR", "KER.PA": "EUR",
}

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


def get_eurusd():
    try:
        df = yf.download("EURUSD=X", period="5d", auto_adjust=True, progress=False)
        if not df.empty:
            df.columns = df.columns.get_level_values(0)
            return float(df["Close"].iat[-1])
    except Exception:
        pass
    return 1.08


def to_eur(price, ticker, eurusd):
    return price if TICKER_CURRENCY.get(ticker, "USD") == "EUR" else price / eurusd


def compute_rsi(close, length=14):
    delta = close.diff()
    gain  = delta.clip(lower=0).ewm(com=length-1, min_periods=length).mean()
    loss  = (-delta.clip(upper=0)).ewm(com=length-1, min_periods=length).mean()
    rsi   = 100 - (100 / (1 + gain / loss))
    val   = rsi.iat[-1]
    return float(val.item()) if hasattr(val, "item") else float(val)


def compute_macd_signal(close):
    ema12  = close.ewm(span=12, adjust=False).mean()
    ema26  = close.ewm(span=26, adjust=False).mean()
    macd   = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return float(macd.iat[-1]) > float(signal.iat[-1])


def send_telegram(token, chat_id, text):
    url  = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=10)


def scan_for_user(user_id, tg_token, tg_chat, eurusd):
    strong_buys, buys = [], []

    # Watchlist de base + watchlist perso
    watchlist = dict(WATCHLIST)
    custom = supabase.table("watchlist_custom").select("nom,ticker").eq("user_id", user_id).execute().data
    for r in custom:
        watchlist[r["nom"]] = r["ticker"]

    for nom, ticker in watchlist.items():
        try:
            df = yf.download(ticker, period="3mo", auto_adjust=True, progress=False)
            if df.empty or len(df) < 30: continue
            df.columns = df.columns.get_level_values(0)
            rsi       = compute_rsi(df["Close"])
            price_eur = to_eur(float(df["Close"].iat[-1]), ticker, eurusd)
            macd_up   = compute_macd_signal(df["Close"])

            if rsi < 30:
                entry = {"nom": nom, "ticker": ticker, "rsi": rsi, "prix": price_eur, "macd_up": macd_up}
                if macd_up: strong_buys.append(entry)
                else:       buys.append(entry)
        except Exception as e:
            print(f"Erreur {ticker}: {e}")

    total = len(strong_buys) + len(buys)
    if total == 0:
        print(f"Aucune opportunité ({user_id})")
        return

    lines = ["📊 <b>Scan quotidien — Opportunités d'achat</b>\n"]
    if strong_buys:
        lines.append("🟢 <b>ACHAT FORT</b> (RSI &lt; 30 + MACD haussier)")
        for e in sorted(strong_buys, key=lambda x: x["rsi"]):
            lines.append(f"  • <b>{e['nom']}</b> ({e['ticker']}) — {e['prix']:.2f} € · RSI {e['rsi']:.1f}")
    if buys:
        lines.append("\n🟡 <b>Zone d'achat</b> (RSI &lt; 30)")
        for e in sorted(buys, key=lambda x: x["rsi"]):
            lines.append(f"  • {e['nom']} ({e['ticker']}) — {e['prix']:.2f} € · RSI {e['rsi']:.1f}")

    send_telegram(tg_token, tg_chat, "\n".join(lines))
    print(f"✅ Scan envoyé à {user_id} : {total} opportunité(s)")


def main():
    eurusd = get_eurusd()
    users  = supabase.table("telegram_config").select("user_id,token,chat_id").execute().data
    if not users:
        print("Aucun utilisateur avec Telegram configuré.")
        return
    for u in users:
        uid, token, chat_id = u["user_id"], u.get("token"), u.get("chat_id")
        if not token or not chat_id: continue
        print(f"\n── Scan {uid} ──────────────────────────────────────")
        scan_for_user(uid, token, chat_id, eurusd)


if __name__ == "__main__":
    main()
