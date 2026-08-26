#!/usr/bin/env python3
"""Vérifie les alertes prix ET RSI pour tous les utilisateurs — lit depuis Supabase."""
import os
import json
import subprocess
import urllib.request
import urllib.parse
import warnings
from datetime import date

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


def last_close(df):
    val = df["Close"].iat[-1]
    return float(val.item()) if hasattr(val, "item") else float(val)


def get_eurusd():
    try:
        df = yf.download("EURUSD=X", period="5d", auto_adjust=True, progress=False)
        if not df.empty:
            df.columns = df.columns.get_level_values(0)
            return last_close(df)
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


def send_telegram(token, chat_id, text):
    url  = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=10)


def get_all_users():
    rows = supabase.table("telegram_config").select("user_id,token,chat_id").execute().data
    return rows


def check_price_alerts(user_id, tg_token, tg_chat, eurusd):
    alerts = supabase.table("alerts").select("*").eq("user_id", user_id).execute().data
    for a in alerts:
        ticker = a["ticker"]
        try:
            df = yf.download(ticker, period="5d", auto_adjust=True, progress=False)
            if df.empty: continue
            df.columns = df.columns.get_level_values(0)
            price_eur = to_eur(last_close(df), ticker, eurusd)
            nom = a.get("nom", ticker)

            if a.get("seuil_bas") and price_eur <= a["seuil_bas"]:
                msg = (f"🟢 <b>Alerte ACHAT — {nom}</b>\n"
                       f"Prix : <b>{price_eur:.2f} €</b> ≤ seuil {a['seuil_bas']:.2f} €")
                send_telegram(tg_token, tg_chat, msg)
                print(f"✅ Alerte ACHAT : {nom} ({user_id})")

            if a.get("seuil_haut") and price_eur >= a["seuil_haut"]:
                msg = (f"🔴 <b>Alerte VENTE — {nom}</b>\n"
                       f"Prix : <b>{price_eur:.2f} €</b> ≥ seuil {a['seuil_haut']:.2f} €")
                send_telegram(tg_token, tg_chat, msg)
                print(f"✅ Alerte VENTE : {nom} ({user_id})")
        except Exception as e:
            print(f"Erreur alerte prix {ticker} ({user_id}): {e}")


def check_rsi_alerts(user_id, tg_token, tg_chat, eurusd):
    today = str(date.today())
    state_rows = supabase.table("rsi_state").select("*").eq("user_id", user_id).execute().data
    state = {r["ticker"]: {"zone": r["zone"], "alerted_date": r["alerted_date"]} for r in state_rows}

    rsi_msgs_buy, rsi_msgs_sell = [], []

    for nom, ticker in WATCHLIST.items():
        try:
            df = yf.download(ticker, period="3mo", auto_adjust=True, progress=False)
            if df.empty or len(df) < 20: continue
            df.columns = df.columns.get_level_values(0)
            rsi       = compute_rsi(df["Close"])
            price_eur = to_eur(last_close(df), ticker, eurusd)

            prev      = state.get(ticker, {"zone": "neutral", "alerted_date": ""})
            prev_zone = prev.get("zone", "neutral")
            new_zone  = "buy" if rsi < 30 else ("sell" if rsi > 70 else "neutral")

            alerted_today = prev.get("alerted_date") == today
            if new_zone != prev_zone and not alerted_today:
                if new_zone == "buy":
                    rsi_msgs_buy.append(f"  • <b>{nom}</b> ({ticker}) — {price_eur:.2f} € · RSI {rsi:.1f}")
                elif new_zone == "sell":
                    rsi_msgs_sell.append(f"  • <b>{nom}</b> ({ticker}) — {price_eur:.2f} € · RSI {rsi:.1f}")

            new_alerted = today if (new_zone != "neutral" and new_zone != prev_zone) else prev.get("alerted_date", "")
            supabase.table("rsi_state").upsert(
                {"user_id": user_id, "ticker": ticker, "zone": new_zone, "alerted_date": new_alerted},
                on_conflict="user_id,ticker"
            ).execute()

        except Exception as e:
            print(f"Erreur RSI {ticker} ({user_id}): {e}")

    if rsi_msgs_buy or rsi_msgs_sell:
        lines = ["📊 <b>Alerte RSI — Nouvelles zones</b>\n"]
        if rsi_msgs_buy:
            lines.append("🟢 <b>En zone ACHAT</b> (RSI < 30)")
            lines.extend(rsi_msgs_buy)
        if rsi_msgs_sell:
            lines.append("\n🔴 <b>En zone VENTE</b> (RSI > 70)")
            lines.extend(rsi_msgs_sell)
        send_telegram(tg_token, tg_chat, "\n".join(lines))
        print(f"✅ RSI alertes envoyées ({user_id})")
    else:
        print(f"Aucune nouvelle zone RSI ({user_id})")


def main():
    eurusd = get_eurusd()
    users  = get_all_users()
    if not users:
        print("Aucun utilisateur avec Telegram configuré.")
        return

    for u in users:
        uid, token, chat_id = u["user_id"], u.get("token"), u.get("chat_id")
        if not token or not chat_id:
            continue
        print(f"\n── {uid} ──────────────────────────────────────")
        check_price_alerts(uid, token, chat_id, eurusd)
        check_rsi_alerts(uid, token, chat_id, eurusd)


if __name__ == "__main__":
    main()
