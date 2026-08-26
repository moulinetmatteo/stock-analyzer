import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import uuid
from datetime import datetime, date
import subprocess
import urllib.request
import urllib.parse
import bcrypt
from supabase import create_client

st.set_page_config(page_title="Stock Analyzer", layout="wide", page_icon="📈")

# ── Constantes ────────────────────────────────────────────────────────────────
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

WATCHLIST = {
    "── US Tech ──": None,
    "Apple": "AAPL", "Microsoft": "MSFT", "Google": "GOOGL", "Amazon": "AMZN",
    "NVIDIA": "NVDA", "Tesla": "TSLA", "Meta": "META", "Netflix": "NFLX",
    "AMD": "AMD", "Intel": "INTC", "Oracle": "ORCL", "Salesforce": "CRM", "Adobe": "ADBE",
    "── US Finance ──": None,
    "JPMorgan": "JPM", "Bank of America": "BAC", "Goldman Sachs": "GS", "Visa": "V", "Mastercard": "MA",
    "── US Santé ──": None,
    "Johnson & Johnson": "JNJ", "Pfizer": "PFE", "UnitedHealth": "UNH",
    "── US Énergie ──": None,
    "ExxonMobil": "XOM", "Chevron": "CVX",
    "── France (CAC 40) ──": None,
    "LVMH": "MC.PA", "TotalEnergies": "TTE.PA", "Airbus": "AIR.PA", "Sanofi": "SAN.PA",
    "BNP Paribas": "BNP.PA", "L'Oréal": "OR.PA", "Schneider Electric": "SU.PA",
    "Capgemini": "CAP.PA", "Hermès": "RMS.PA", "Kering": "KER.PA",
    "── ETF ──": None,
    "S&P 500 (SPY)": "SPY", "Nasdaq 100 (QQQ)": "QQQ",
    "MSCI World (IWDA)": "IWDA.AS", "Total US Market (VTI)": "VTI", "S&P 500 EUR (CSPX)": "CSPX.AS",
}
TICKERS_ONLY = {k: v for k, v in WATCHLIST.items() if v is not None}

PERIOD_OPTIONS = {"14 jours": "14d", "1 mois": "1mo", "3 mois": "3mo", "6 mois": "6mo", "1 an": "1y", "2 ans": "2y"}
DOWNLOAD_PERIOD = {"14d": "6mo", "1mo": "6mo", "3mo": "6mo", "6mo": "6mo", "1y": "1y", "2y": "2y"}


# ── Supabase ──────────────────────────────────────────────────────────────────
@st.cache_resource
def init_supabase():
    return create_client(st.secrets["supabase"]["url"], st.secrets["supabase"]["key"])

supabase = init_supabase()


# ── Authentification ──────────────────────────────────────────────────────────
def auth_login(username: str, password: str) -> tuple:
    try:
        rows = supabase.table("users").select("*").eq("username", username.lower().strip()).execute().data
        if not rows:
            return False, "", ""
        u = rows[0]
        if bcrypt.checkpw(password.encode(), u["password_hash"].encode()):
            return True, u["username"], u["name"]
    except Exception:
        pass
    return False, "", ""

def auth_register(username: str, email: str, name: str, password: str, confirm: str) -> tuple:
    username = username.lower().strip()
    if not username or not password:
        return False, "Remplis tous les champs obligatoires."
    if password != confirm:
        return False, "Les mots de passe ne correspondent pas."
    if len(password) < 6:
        return False, "Mot de passe trop court (6 caractères min)."
    try:
        if supabase.table("users").select("username").eq("username", username).execute().data:
            return False, "Ce nom d'utilisateur est déjà pris."
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        supabase.table("users").insert({
            "username": username, "email": email.strip(),
            "name": name.strip() or username, "password_hash": pw_hash,
        }).execute()
        return True, "Compte créé ! Tu peux maintenant te connecter."
    except Exception as e:
        return False, f"Erreur : {e}"

if not st.session_state.get("authenticated"):
    st.title("📈 Stock Analyzer")
    tab_login, tab_register = st.tabs(["Se connecter", "Créer un compte"])

    with tab_login:
        with st.form("login_form"):
            l_user = st.text_input("Nom d'utilisateur")
            l_pass = st.text_input("Mot de passe", type="password")
            if st.form_submit_button("Connexion", type="primary"):
                ok, uid, uname = auth_login(l_user, l_pass)
                if ok:
                    st.session_state["authenticated"] = True
                    st.session_state["username"]      = uid
                    st.session_state["name"]          = uname
                    st.rerun()
                else:
                    st.error("Identifiants incorrects.")

    with tab_register:
        with st.form("register_form"):
            r_user    = st.text_input("Nom d'utilisateur *")
            r_name    = st.text_input("Prénom")
            r_email   = st.text_input("Email")
            r_pass    = st.text_input("Mot de passe * (6 caractères min)", type="password")
            r_confirm = st.text_input("Confirmer le mot de passe *", type="password")
            if st.form_submit_button("Créer mon compte", type="primary"):
                ok, msg = auth_register(r_user, r_email, r_name, r_pass, r_confirm)
                if ok:
                    st.success(msg)
                else:
                    st.error(msg)
    st.stop()

UID       = st.session_state["username"]
USER_NAME = st.session_state["name"]


# ── Données Supabase ──────────────────────────────────────────────────────────
def get_portfolio() -> dict:
    rows = supabase.table("portfolio").select("*").eq("user_id", UID).execute().data
    return {r["ticker"]: {"nom": r["nom"], "quantite": r["quantite"], "prix_achat": r["prix_achat"]} for r in rows}

def upsert_position(ticker: str, nom: str, qty: float, price: float):
    supabase.table("portfolio").upsert(
        {"user_id": UID, "ticker": ticker, "nom": nom, "quantite": qty, "prix_achat": price},
        on_conflict="user_id,ticker"
    ).execute()

def delete_position(ticker: str):
    supabase.table("portfolio").delete().eq("user_id", UID).eq("ticker", ticker).execute()

def get_transactions() -> list:
    return supabase.table("transactions").select("*").eq("user_id", UID).order("date", desc=True).execute().data

def add_transaction(tx: dict):
    supabase.table("transactions").insert({**tx, "user_id": UID}).execute()

def delete_transaction(tx_id: str):
    supabase.table("transactions").delete().eq("user_id", UID).eq("id", tx_id).execute()

def get_alerts() -> dict:
    rows = supabase.table("alerts").select("*").eq("user_id", UID).execute().data
    return {r["ticker"]: {"nom": r["nom"], "seuil_bas": r.get("seuil_bas"), "seuil_haut": r.get("seuil_haut")} for r in rows}

def upsert_alert(ticker: str, nom: str, seuil_bas, seuil_haut):
    supabase.table("alerts").upsert(
        {"user_id": UID, "ticker": ticker, "nom": nom, "seuil_bas": seuil_bas, "seuil_haut": seuil_haut},
        on_conflict="user_id,ticker"
    ).execute()

def delete_alert(ticker: str):
    supabase.table("alerts").delete().eq("user_id", UID).eq("ticker", ticker).execute()

def get_custom_watchlist() -> dict:
    rows = supabase.table("watchlist_custom").select("*").eq("user_id", UID).execute().data
    return {r["nom"]: r["ticker"] for r in rows}

def upsert_custom_ticker(nom: str, ticker: str):
    supabase.table("watchlist_custom").upsert(
        {"user_id": UID, "nom": nom, "ticker": ticker},
        on_conflict="user_id,nom"
    ).execute()

def delete_custom_ticker(nom: str):
    supabase.table("watchlist_custom").delete().eq("user_id", UID).eq("nom", nom).execute()

def get_tg_config() -> dict:
    rows = supabase.table("telegram_config").select("*").eq("user_id", UID).execute().data
    return rows[0] if rows else {}

def save_tg_config(token: str, chat_id: str):
    supabase.table("telegram_config").upsert(
        {"user_id": UID, "token": token, "chat_id": chat_id},
        on_conflict="user_id"
    ).execute()


# ── Indicateurs ───────────────────────────────────────────────────────────────
def compute_rsi(close: pd.Series, length: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(com=length - 1, min_periods=length).mean()
    loss = (-delta.clip(upper=0)).ewm(com=length - 1, min_periods=length).mean()
    return 100 - (100 / (1 + gain / loss))

def compute_macd(close, fast=12, slow=26, signal=9):
    ema_f = close.ewm(span=fast, adjust=False).mean()
    ema_s = close.ewm(span=slow, adjust=False).mean()
    macd  = ema_f - ema_s
    sig   = macd.ewm(span=signal, adjust=False).mean()
    return macd, sig, macd - sig

def compute_bollinger(close, length=20, std=2.0):
    mid = close.ewm(span=length, adjust=False).mean()
    rs  = close.rolling(length).std()
    return mid, mid + std * rs, mid - std * rs

def compute_stochastic(high, low, close, k=14, d=3):
    lo    = low.rolling(k).min(); hi = high.rolling(k).max()
    pct_k = (close - lo) / (hi - lo) * 100
    return pct_k, pct_k.rolling(d).mean()


@st.cache_data(ttl=300)
def load_price_data(ticker: str, period: str) -> pd.DataFrame:
    dl = DOWNLOAD_PERIOD.get(period, period)
    df = yf.download(ticker, period=dl, auto_adjust=True, progress=False)
    if df.empty: return df
    df.columns = df.columns.get_level_values(0)
    df["RSI"]  = compute_rsi(df["Close"])
    df["MACD"], df["MACD_signal"], df["MACD_hist"] = compute_macd(df["Close"])
    df["EMA20"]  = df["Close"].ewm(span=20,  adjust=False).mean()
    df["EMA50"]  = df["Close"].ewm(span=50,  adjust=False).mean()
    df["EMA200"] = df["Close"].ewm(span=200, adjust=False).mean()
    df["BB_mid"], df["BB_up"], df["BB_low"] = compute_bollinger(df["Close"])
    df["STOCH_K"], df["STOCH_D"] = compute_stochastic(df["High"], df["Low"], df["Close"])
    return df

def filter_display(df: pd.DataFrame, period: str) -> pd.DataFrame:
    return df.last("14D") if period == "14d" else df

@st.cache_data(ttl=600)
def load_fundamentals(ticker: str) -> dict:
    try:
        info = yf.Ticker(ticker).info
        return {
            "Capitalisation": info.get("marketCap"),
            "P/E ratio":      info.get("trailingPE"),
            "Dividende (%)":  info.get("dividendYield"),
            "Beta":           info.get("beta"),
            "52s haut":       info.get("fiftyTwoWeekHigh"),
            "52s bas":        info.get("fiftyTwoWeekLow"),
            "Secteur":        info.get("sector", "—"),
            "Devise":         info.get("currency", ""),
        }
    except Exception: return {}

@st.cache_data(ttl=3600)
def get_eurusd() -> float:
    try:
        df = yf.download("EURUSD=X", period="5d", auto_adjust=True, progress=False)
        if not df.empty:
            df.columns = df.columns.get_level_values(0)
            return float(df["Close"].iloc[-1])
    except Exception: pass
    return 1.08

@st.cache_data(ttl=600)
def get_ticker_currency(ticker: str) -> str:
    if ticker in TICKER_CURRENCY: return TICKER_CURRENCY[ticker]
    try: return yf.Ticker(ticker).fast_info.get("currency", "USD")
    except Exception: return "USD"

def to_eur(price: float, ticker: str, eurusd: float) -> float:
    return price if get_ticker_currency(ticker) == "EUR" else price / eurusd

def fmt_cap(val, eurusd=1.08):
    if not val: return "—"
    v = val / eurusd
    if v >= 1e12: return f"{v/1e12:.1f} B€"
    if v >= 1e9:  return f"{v/1e9:.1f} Md€"
    return f"{v/1e6:.0f} M€"

def signal_badge(rsi, macd, macd_signal, stoch_k=None, close=None, bb_low=None, bb_up=None):
    if rsi is None or (isinstance(rsi, float) and np.isnan(rsi)): return "—", "#9e9e9e"
    b = s = 0
    if rsi < 30: b += 1
    if rsi > 70: s += 1
    if macd is not None and macd_signal is not None:
        if macd > macd_signal: b += 1
        else: s += 1
    if stoch_k is not None and not np.isnan(stoch_k):
        if stoch_k < 20: b += 1
        elif stoch_k > 80: s += 1
    if close is not None and bb_low is not None and not np.isnan(bb_low):
        if close <= bb_low: b += 1
        elif bb_up is not None and not np.isnan(bb_up) and close >= bb_up: s += 1
    if b >= 3: return "ACHAT fort", "#00c853"
    if b == 2: return "Achat possible", "#69f0ae"
    if s >= 3: return "VENTE forte", "#d50000"
    if s == 2: return "Vente possible", "#ff5252"
    return "Neutre", "#9e9e9e"

def scalar(val):
    if hasattr(val, "item"): return float(val.item())
    return float(val)

@st.cache_data(ttl=3600)
def get_earnings_date(ticker: str) -> str:
    try:
        cal = yf.Ticker(ticker).calendar
        if isinstance(cal, dict):
            ed = cal.get("Earnings Date", [])
            if ed: return str(ed[0])[:10]
        elif hasattr(cal, "empty") and not cal.empty and "Earnings Date" in cal.index:
            return str(cal.loc["Earnings Date"].iloc[0])[:10]
    except Exception: pass
    return ""


# ── Session state ─────────────────────────────────────────────────────────────
eurusd = get_eurusd()
if "tg_config" not in st.session_state:
    st.session_state.tg_config = get_tg_config()


# ── Sidebar ───────────────────────────────────────────────────────────────────
st.sidebar.title("📈 Stock Analyzer")
st.sidebar.caption(f"Connecté : **{USER_NAME}**")
st.sidebar.caption(f"1 € = {eurusd:.4f} $")
if st.sidebar.button("🚪 Déconnexion"):
    st.session_state.clear()
    st.rerun()
st.sidebar.divider()

page = st.sidebar.radio("Navigation", [
    "Dashboard", "Screener", "Analyse détaillée",
    "Mon Portefeuille", "Backtesting", "Alertes", "Paramètres"
])
period_label = st.sidebar.selectbox("Période", list(PERIOD_OPTIONS.keys()), index=2)
period = PERIOD_OPTIONS[period_label]
custom_ticker = st.sidebar.text_input("Ticker personnalisé", placeholder="ex: AIR.PA, AAPL")

custom_wl = get_custom_watchlist()
active_tickers = {**TICKERS_ONLY, **custom_wl}
if custom_ticker.strip():
    active_tickers[custom_ticker.upper()] = custom_ticker.upper()

# Alertes sidebar
alerts = get_alerts()
triggered_sidebar = []
for tk, alert in alerts.items():
    try:
        df_a = load_price_data(tk, "1mo")
        if df_a.empty: continue
        p = to_eur(scalar(df_a["Close"].iloc[-1]), tk, eurusd)
        if alert.get("seuil_bas") and p <= alert["seuil_bas"]:
            triggered_sidebar.append(f"🟢 **{tk}** {p:.2f} € ≤ {alert['seuil_bas']:.2f} €")
        if alert.get("seuil_haut") and p >= alert["seuil_haut"]:
            triggered_sidebar.append(f"🔴 **{tk}** {p:.2f} € ≥ {alert['seuil_haut']:.2f} €")
    except Exception: pass
if triggered_sidebar:
    st.sidebar.markdown("---")
    st.sidebar.markdown("### 🔔 Alertes")
    for t in triggered_sidebar:
        st.sidebar.markdown(t)


# ─────────────────────────────────────────────────────────────────────────────
# PAGE : DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
if page == "Dashboard":
    st.title("Dashboard")

    portfolio = get_portfolio()

    if portfolio:
        total_val, total_invest = 0.0, 0.0
        for tk, pos in portfolio.items():
            df_p = load_price_data(tk, "1mo")
            if df_p.empty: continue
            p = to_eur(scalar(df_p["Close"].iloc[-1]), tk, eurusd)
            total_val    += pos["quantite"] * p
            total_invest += pos["quantite"] * pos["prix_achat"]
        pnl = total_val - total_invest
        pnl_pct = pnl / total_invest * 100 if total_invest else 0
        c1, c2, c3 = st.columns(3)
        c1.metric("Valeur du portefeuille", f"{total_val:,.2f} €")
        c2.metric("Montant investi",         f"{total_invest:,.2f} €")
        c3.metric("P&L total",               f"{pnl:+,.2f} €", f"{pnl_pct:+.2f}%")
        st.divider()

    st.subheader("Mouvements du jour")
    movers = []
    sample = list(TICKERS_ONLY.items())[:20]
    prog = st.progress(0, "Chargement movers…")
    for i, (nm, tk) in enumerate(sample):
        prog.progress((i+1)/len(sample), nm)
        try:
            df_m = load_price_data(tk, "1mo")
            if df_m.empty or len(df_m) < 2: continue
            p  = to_eur(scalar(df_m["Close"].iloc[-1]), tk, eurusd)
            p0 = to_eur(scalar(df_m["Close"].iloc[-2]), tk, eurusd)
            movers.append({"Nom": nm, "Prix (€)": round(p,2), "Var. (%)": round((p-p0)/p0*100,2)})
        except Exception: pass
    prog.empty()
    if movers:
        df_mv = pd.DataFrame(movers).sort_values("Var. (%)", ascending=False)
        col_up, col_dn = st.columns(2)
        with col_up:
            st.markdown("**🟢 Top hausses**")
            st.dataframe(df_mv.head(5), use_container_width=True, hide_index=True)
        with col_dn:
            st.markdown("**🔴 Top baisses**")
            st.dataframe(df_mv.tail(5).iloc[::-1], use_container_width=True, hide_index=True)

    st.divider()
    st.subheader("Opportunités RSI")
    opp_buy, opp_sell = [], []
    for nm, tk in list(TICKERS_ONLY.items())[:20]:
        try:
            df_o = load_price_data(tk, "3mo")
            if df_o.empty: continue
            rsi_v = scalar(df_o["RSI"].iloc[-1])
            p_v   = to_eur(scalar(df_o["Close"].iloc[-1]), tk, eurusd)
            if rsi_v < 30:   opp_buy.append({"Action": nm, "Prix (€)": round(p_v,2), "RSI": round(rsi_v,1)})
            elif rsi_v > 70: opp_sell.append({"Action": nm, "Prix (€)": round(p_v,2), "RSI": round(rsi_v,1)})
        except Exception: pass
    ob, os_ = st.columns(2)
    with ob:
        st.markdown("**🟢 Zone d'achat** (RSI < 30)")
        if opp_buy: st.dataframe(pd.DataFrame(opp_buy), use_container_width=True, hide_index=True)
        else: st.caption("Aucune action en zone d'achat")
    with os_:
        st.markdown("**🔴 Zone de vente** (RSI > 70)")
        if opp_sell: st.dataframe(pd.DataFrame(opp_sell), use_container_width=True, hide_index=True)
        else: st.caption("Aucune action en zone de vente")

    if triggered_sidebar:
        st.divider()
        st.subheader("🔔 Alertes prix actives")
        for t in triggered_sidebar: st.markdown(t)

    st.divider()
    st.subheader("📅 Prochains résultats d'entreprises")
    with st.spinner("Chargement des dates…"):
        earnings_rows = []
        checked = set()
        priority = list(portfolio.keys()) if portfolio else []
        for nm, tk in list(TICKERS_ONLY.items())[:20]:
            if tk not in priority: priority.append(tk)
        for tk in priority[:22]:
            if tk in checked: continue
            checked.add(tk)
            ed = get_earnings_date(tk)
            if ed and ed >= str(date.today()):
                nom = portfolio.get(tk, {}).get("nom") if portfolio else None
                if not nom:
                    nom = next((n for n, t in TICKERS_ONLY.items() if t == tk), tk)
                earnings_rows.append({"Action": nom, "Ticker": tk, "Date résultats": ed,
                                      "En portefeuille": "✅" if tk in portfolio else ""})
    if earnings_rows:
        df_earn = pd.DataFrame(earnings_rows).sort_values("Date résultats")
        st.dataframe(df_earn, use_container_width=True, hide_index=True)
    else:
        st.caption("Aucune date de résultats prévue prochainement.")


# ─────────────────────────────────────────────────────────────────────────────
# PAGE : SCREENER
# ─────────────────────────────────────────────────────────────────────────────
elif page == "Screener":
    st.title("Screener — Vue d'ensemble")
    st.caption("RSI < 30 : survente (achat potentiel)  ·  RSI > 70 : surachat (vente potentielle)")

    sig_filter = st.selectbox("Filtrer par signal", ["Tous", "Achat (RSI < 30)", "Vente (RSI > 70)", "Neutre"])

    rows, items = [], list(active_tickers.items())
    prog = st.progress(0, "Chargement…")
    for i, (name, ticker) in enumerate(items):
        df = load_price_data(ticker, period)
        prog.progress((i+1)/len(items), name)
        if df.empty or len(df) < 2: continue
        last, prev = df.iloc[-1], df.iloc[-2]
        rsi  = scalar(last["RSI"])  if not pd.isna(last["RSI"])  else None
        macd = scalar(last["MACD"]) if not pd.isna(last["MACD"]) else None
        msig = scalar(last["MACD_signal"]) if not pd.isna(last["MACD_signal"]) else None
        stk  = scalar(last["STOCH_K"]) if not pd.isna(last["STOCH_K"]) else None
        cr   = scalar(last["Close"])
        bbl  = scalar(last["BB_low"])  if not pd.isna(last["BB_low"])  else None
        bbu  = scalar(last["BB_up"])   if not pd.isna(last["BB_up"])   else None
        e50  = scalar(last["EMA50"])   if not pd.isna(last["EMA50"])   else None
        e200 = scalar(last["EMA200"])  if not pd.isna(last["EMA200"])  else None
        ce   = to_eur(cr, ticker, eurusd)
        pe   = to_eur(scalar(prev["Close"]), ticker, eurusd)
        chg  = (ce - pe) / pe * 100
        sig, _ = signal_badge(rsi, macd, msig, stk, cr, bbl, bbu)
        cross = ("🟡 Golden" if e50 and e200 and e50 > e200 else "⚫ Death") if e50 and e200 else "—"
        if sig_filter == "Achat (RSI < 30)"  and (not rsi or rsi >= 30):  continue
        if sig_filter == "Vente (RSI > 70)"  and (not rsi or rsi <= 70):  continue
        if sig_filter == "Neutre" and sig != "Neutre": continue
        rows.append({"Nom": name, "Ticker": ticker, "Prix (€)": round(ce,2),
                     "Var. (%)": round(chg,2), "RSI": round(rsi,1) if rsi else "—",
                     "Stoch %K": round(stk,1) if stk else "—", "Cross": cross, "Signal": sig})
    prog.empty()

    if rows:
        def hl(row):
            s = str(row["Signal"]).lower()
            if "achat fort" in s: return ["background-color:#1b5e20;color:white"]*len(row)
            if "achat" in s:      return ["background-color:#2e7d32;color:white"]*len(row)
            if "vente forte" in s:return ["background-color:#b71c1c;color:white"]*len(row)
            if "vente" in s:      return ["background-color:#c62828;color:white"]*len(row)
            return [""]*len(row)
        st.dataframe(pd.DataFrame(rows).style.apply(hl, axis=1), use_container_width=True, hide_index=True)


# ─────────────────────────────────────────────────────────────────────────────
# PAGE : ANALYSE DÉTAILLÉE
# ─────────────────────────────────────────────────────────────────────────────
elif page == "Analyse détaillée":
    st.title("Analyse détaillée")
    sel    = st.selectbox("Choisir une action", list(active_tickers.keys()))
    ticker = active_tickers[sel]
    df     = load_price_data(ticker, period)
    if df.empty: st.error(f"Données indisponibles pour {ticker}."); st.stop()

    last, prev = df.iloc[-1], df.iloc[-2]
    cr   = scalar(last["Close"])
    ce   = to_eur(cr, ticker, eurusd)
    pe   = to_eur(scalar(prev["Close"]), ticker, eurusd)
    chg  = (ce - pe) / pe * 100
    rsi  = scalar(last["RSI"])  if not pd.isna(last["RSI"])  else None
    macd = scalar(last["MACD"]) if not pd.isna(last["MACD"]) else None
    msig = scalar(last["MACD_signal"]) if not pd.isna(last["MACD_signal"]) else None
    stk  = scalar(last["STOCH_K"]) if not pd.isna(last["STOCH_K"]) else None
    bbl  = scalar(last["BB_low"])  if not pd.isna(last["BB_low"])  else None
    bbu  = scalar(last["BB_up"])   if not pd.isna(last["BB_up"])   else None
    e50  = scalar(last["EMA50"])   if not pd.isna(last["EMA50"])   else None
    e200 = scalar(last["EMA200"])  if not pd.isna(last["EMA200"])  else None
    sig, sig_col = signal_badge(rsi, macd, msig, stk, cr, bbl, bbu)

    c1,c2,c3,c4,c5 = st.columns(5)
    c1.metric("Prix (€)", f"{ce:.2f} €", f"{chg:+.2f}%")
    c2.metric("RSI (14)", f"{rsi:.1f}" if rsi else "—")
    c3.metric("Stoch %K", f"{stk:.1f}" if stk else "—")
    c4.metric("EMA 50/200", "🟡 Golden" if e50 and e200 and e50>e200 else "⚫ Death")
    c5.markdown(f"**Signal**<br><span style='font-size:1.3rem;color:{sig_col}'>{sig}</span>", unsafe_allow_html=True)
    st.divider()

    with st.expander("Données fondamentales", expanded=True):
        fund = load_fundamentals(ticker)
        if fund:
            f1,f2,f3,f4,f5,f6 = st.columns(6)
            f1.metric("Capitalisation", fmt_cap(fund.get("Capitalisation"), eurusd))
            f2.metric("P/E ratio", f"{fund['P/E ratio']:.1f}" if fund.get("P/E ratio") else "—")
            f3.metric("Dividende", f"{fund['Dividende (%)'] * 100:.2f}%" if fund.get("Dividende (%)") else "—")
            f4.metric("Beta", f"{fund['Beta']:.2f}" if fund.get("Beta") else "—")
            he = to_eur(fund["52s haut"], ticker, eurusd) if fund.get("52s haut") else None
            le = to_eur(fund["52s bas"],  ticker, eurusd) if fund.get("52s bas")  else None
            f5.metric("52s haut", f"{he:.2f} €" if he else "—")
            f6.metric("52s bas",  f"{le:.2f} €" if le else "—")
            st.caption(f"Secteur : {fund.get('Secteur','—')}  ·  Devise d'origine : {fund.get('Devise','—')}")

    with st.expander("Indicateurs affichés", expanded=False):
        t1,t2,t3,t4,t5 = st.columns(5)
        show_bb     = t1.checkbox("Bollinger",    value=True)
        show_ema200 = t2.checkbox("EMA 200",      value=True)
        show_vol    = t3.checkbox("Volume",        value=True)
        show_stoch  = t4.checkbox("Stochastique", value=True)
        show_macd   = t5.checkbox("MACD",          value=True)

    fx = 1.0 if get_ticker_currency(ticker) == "EUR" else 1.0/eurusd
    df_eur = df.copy()
    for c in ["Open","High","Low","Close","EMA20","EMA50","EMA200","BB_mid","BB_up","BB_low"]:
        if c in df_eur.columns: df_eur[c] = df[c] * fx
    dv = filter_display(df_eur, period)
    di = filter_display(df, period)

    rh, rt, n, vol_r, stoch_r, macd_r = [0.50], ["Prix"], 1, None, None, None
    if show_vol:   vol_r   = n+1; n+=1; rt.append("Volume");        rh.append(0.12)
    if show_stoch: stoch_r = n+1; n+=1; rt.append("Stochastique"); rh.append(0.13)
    rsi_r = n+1; n+=1; rt.append("RSI (14)"); rh.append(0.13)
    if show_macd:  macd_r  = n+1; n+=1; rt.append("MACD");          rh.append(0.12)
    tot = sum(rh); rh = [h/tot for h in rh]

    fig = make_subplots(rows=n, cols=1, shared_xaxes=True, row_heights=rh,
                        vertical_spacing=0.03, subplot_titles=rt)
    fig.add_trace(go.Candlestick(x=dv.index, open=dv["Open"], high=dv["High"],
        low=dv["Low"], close=dv["Close"], name="Prix (€)",
        increasing_line_color="#26a69a", decreasing_line_color="#ef5350"), row=1, col=1)
    fig.add_trace(go.Scatter(x=dv.index, y=dv["EMA20"], name="EMA 20",
        line=dict(color="#ffa726", width=1.5)), row=1, col=1)
    fig.add_trace(go.Scatter(x=dv.index, y=dv["EMA50"], name="EMA 50",
        line=dict(color="#ab47bc", width=1.5)), row=1, col=1)
    if show_ema200:
        fig.add_trace(go.Scatter(x=dv.index, y=dv["EMA200"], name="EMA 200",
            line=dict(color="#ef5350", width=1.5, dash="dot")), row=1, col=1)
    if show_bb:
        fig.add_trace(go.Scatter(x=dv.index, y=dv["BB_up"],  name="BB haut",
            line=dict(color="#546e7a", width=1)), row=1, col=1)
        fig.add_trace(go.Scatter(x=dv.index, y=dv["BB_low"], name="BB bas",
            line=dict(color="#546e7a", width=1), fill="tonexty",
            fillcolor="rgba(84,110,122,0.1)"), row=1, col=1)
    if show_vol and vol_r:
        cv = ["#26a69a" if c>=o else "#ef5350" for c,o in zip(dv["Close"], dv["Open"])]
        fig.add_trace(go.Bar(x=dv.index, y=di["Volume"], name="Volume",
            marker_color=cv), row=vol_r, col=1)
    if show_stoch and stoch_r:
        fig.add_trace(go.Scatter(x=di.index, y=di["STOCH_K"], name="%K",
            line=dict(color="#29b6f6", width=1.5)), row=stoch_r, col=1)
        fig.add_trace(go.Scatter(x=di.index, y=di["STOCH_D"], name="%D",
            line=dict(color="#ffa726", width=1.5, dash="dot")), row=stoch_r, col=1)
        fig.add_hline(y=80, line_dash="dash", line_color="#ef5350", row=stoch_r, col=1)
        fig.add_hline(y=20, line_dash="dash", line_color="#26a69a", row=stoch_r, col=1)
    fig.add_trace(go.Scatter(x=di.index, y=di["RSI"], name="RSI",
        line=dict(color="#ce93d8", width=2)), row=rsi_r, col=1)
    fig.add_hline(y=70, line_dash="dash", line_color="#ef5350", row=rsi_r, col=1)
    fig.add_hline(y=30, line_dash="dash", line_color="#26a69a", row=rsi_r, col=1)
    fig.add_hrect(y0=70, y1=100, fillcolor="#ef5350", opacity=0.07, row=rsi_r, col=1)
    fig.add_hrect(y0=0,  y1=30,  fillcolor="#26a69a", opacity=0.07, row=rsi_r, col=1)
    if show_macd and macd_r:
        ch = ["#26a69a" if v>=0 else "#ef5350" for v in di["MACD_hist"].fillna(0)]
        fig.add_trace(go.Bar(x=di.index, y=di["MACD_hist"], name="Hist.", marker_color=ch), row=macd_r, col=1)
        fig.add_trace(go.Scatter(x=di.index, y=di["MACD"], name="MACD",
            line=dict(color="#ffa726", width=1.5)), row=macd_r, col=1)
        fig.add_trace(go.Scatter(x=di.index, y=di["MACD_signal"], name="Signal",
            line=dict(color="#ab47bc", width=1.5)), row=macd_r, col=1)
    fig.update_layout(height=820, template="plotly_dark", xaxis_rangeslider_visible=False,
        legend=dict(orientation="h", y=1.02, x=0), margin=dict(l=10,r=10,t=40,b=10))
    st.plotly_chart(fig, use_container_width=True)

    with st.expander("Comment lire ces indicateurs ?"):
        st.markdown("""
**RSI** : < 30 = survendu (achat) · > 70 = suracheté (vente).
**Stochastique** : < 20 = achat · > 80 = vente · croisement %K/%D = signal de retournement.
**Bollinger** : prix sur bande basse = achat · bande haute = vente · bandes serrées = explosion imminente.
**Golden/Death Cross** : EMA 50 au-dessus de EMA 200 = tendance haussière long terme.
**MACD** : croisement à la hausse = achat · à la baisse = vente.
**Signal global** : 3+ indicateurs alignés = signal fort.
> ⚠️ Aide à la décision uniquement. Ne jamais investir plus que ce qu'on peut se permettre de perdre.
""")

    st.subheader("Actualités récentes")
    try:
        news = yf.Ticker(ticker).news or []
        for art in news[:6]:
            ct    = art.get("content", {})
            title = ct.get("title") or art.get("title", "—")
            pub   = ct.get("provider", {}).get("displayName") or art.get("publisher", "")
            url   = (ct.get("canonicalUrl", {}).get("url")
                     or ct.get("clickThroughUrl", {}).get("url")
                     or art.get("link", "#"))
            dt_s  = ct.get("pubDate", "")
            try:
                dt_s = datetime.fromisoformat(dt_s.replace("Z", "+00:00")).strftime("%d/%m %H:%M")
            except Exception: pass
            st.markdown(f"**[{title}]({url})**  \n"
                        f"<span style='color:#9e9e9e;font-size:.85rem'>{pub} · {dt_s}</span>",
                        unsafe_allow_html=True)
            st.divider()
    except Exception: st.caption("Actualités indisponibles.")


# ─────────────────────────────────────────────────────────────────────────────
# PAGE : PORTEFEUILLE
# ─────────────────────────────────────────────────────────────────────────────
elif page == "Mon Portefeuille":
    st.title("Mon Portefeuille")
    portfolio    = get_portfolio()
    transactions = get_transactions()

    tab_pos, tab_tx, tab_chart = st.tabs(["Positions", "Historique transactions", "Graphiques"])

    # ── Onglet Positions ──────────────────────────────────────────────────────
    with tab_pos:
        with st.expander("Ajouter / modifier une position", expanded=not bool(portfolio)):
            all_names = list(active_tickers.keys())
            sel_p = st.selectbox("Action", all_names, key="port_sel")
            tk_p  = active_tickers[sel_p]
            qty   = st.number_input("Quantité", min_value=0.01, step=1.0,  value=1.0,   key="port_qty")
            buy_p = st.number_input("Prix d'achat moyen (€)", min_value=0.01, step=0.01, value=100.0, key="port_price")
            if st.button("Enregistrer la position"):
                upsert_position(tk_p, sel_p, qty, buy_p)
                st.success(f"Position {sel_p} enregistrée.")
                st.rerun()

        if not portfolio:
            st.info("Aucune position. Ajoute-en une ci-dessus.")
        else:
            rows, tv, ti = [], 0.0, 0.0
            for tk_p, pos in portfolio.items():
                df_p = load_price_data(tk_p, "1mo")
                if df_p.empty: continue
                p = to_eur(scalar(df_p["Close"].iloc[-1]), tk_p, eurusd)
                q, b = pos["quantite"], pos["prix_achat"]
                invest = q * b; val = q * p
                tv += val; ti += invest
                rows.append({"Nom": pos["nom"], "Ticker": tk_p, "Qté": q,
                             "Achat (€)": round(b,2), "Actuel (€)": round(p,2),
                             "Valeur (€)": round(val,2), "P&L (€)": round(val-invest,2),
                             "P&L (%)": round((p-b)/b*100,2)})
            pnl_t = tv - ti
            c1,c2,c3 = st.columns(3)
            c1.metric("Valeur totale", f"{tv:,.2f} €")
            c2.metric("Investi",       f"{ti:,.2f} €")
            c3.metric("P&L", f"{pnl_t:+,.2f} €", f"{pnl_t/ti*100:+.2f}%" if ti else "—")
            st.divider()

            def cpnl(row):
                v = row["P&L (%)"]
                if v > 0: return [""]*6 + ["color:#00c853;font-weight:bold"]*2
                if v < 0: return [""]*6 + ["color:#ef5350;font-weight:bold"]*2
                return [""]*len(row)
            st.dataframe(pd.DataFrame(rows).style.apply(cpnl, axis=1), use_container_width=True, hide_index=True)

            st.divider()
            to_del = st.selectbox("Supprimer une position", ["—"] + list(portfolio.keys()))
            if st.button("Supprimer") and to_del != "—":
                delete_position(to_del); st.rerun()

    # ── Onglet Transactions ───────────────────────────────────────────────────
    with tab_tx:
        with st.expander("Enregistrer une transaction", expanded=True):
            all_names = list(active_tickers.keys())
            tx_sel    = st.selectbox("Action", all_names, key="tx_sel")
            tx_ticker = active_tickers[tx_sel]
            tx_action = st.radio("Type", ["Achat", "Vente"], horizontal=True)
            tx_date   = st.date_input("Date", value=date.today())
            tx_qty    = st.number_input("Quantité", min_value=0.01, step=1.0,  value=1.0,   key="tx_qty")
            tx_price  = st.number_input("Prix unitaire (€)", min_value=0.01, step=0.01, value=100.0, key="tx_price")

            if st.button("Enregistrer la transaction"):
                tx = {
                    "id":       str(uuid.uuid4())[:8],
                    "date":     str(tx_date),
                    "ticker":   tx_ticker,
                    "nom":      tx_sel,
                    "action":   tx_action.lower(),
                    "quantite": tx_qty,
                    "prix":     tx_price,
                    "montant":  round(tx_qty * tx_price, 2),
                }
                add_transaction(tx)
                # Mise à jour automatique de la position
                portfolio = get_portfolio()
                pos = portfolio.get(tx_ticker, {"nom": tx_sel, "quantite": 0, "prix_achat": tx_price})
                if tx_action == "Achat":
                    old_qty, old_price = pos["quantite"], pos["prix_achat"]
                    new_qty = old_qty + tx_qty
                    new_price = (old_qty * old_price + tx_qty * tx_price) / new_qty
                    upsert_position(tx_ticker, tx_sel, new_qty, new_price)
                else:
                    new_qty = max(0, pos["quantite"] - tx_qty)
                    if new_qty == 0:
                        delete_position(tx_ticker)
                    else:
                        upsert_position(tx_ticker, tx_sel, new_qty, pos["prix_achat"])
                st.success("Transaction enregistrée et position mise à jour.")
                st.rerun()

        if transactions:
            df_tx = pd.DataFrame(transactions)
            cols_show = ["date","nom","ticker","action","quantite","prix","montant"]
            df_tx = df_tx[[c for c in cols_show if c in df_tx.columns]]
            df_tx.columns = ["Date","Nom","Ticker","Action","Qté","Prix (€)","Montant (€)"][:len(df_tx.columns)]

            def hl_tx(row):
                if str(row.get("Action","")).lower() == "achat":
                    return ["background-color:#1b5e20;color:white"]*len(row)
                return ["background-color:#b71c1c;color:white"]*len(row)

            st.dataframe(df_tx.style.apply(hl_tx, axis=1), use_container_width=True, hide_index=True)

            all_ids = [t["id"] for t in transactions]
            to_del_tx = st.selectbox("Supprimer une transaction (par ID)", ["—"] + all_ids)
            if st.button("Supprimer transaction") and to_del_tx != "—":
                delete_transaction(to_del_tx); st.rerun()
        else:
            st.info("Aucune transaction enregistrée.")

    # ── Onglet Graphiques ─────────────────────────────────────────────────────
    with tab_chart:
        portfolio = get_portfolio()
        if not portfolio:
            st.info("Aucune position pour afficher les graphiques.")
        else:
            pie_labels, pie_vals = [], []
            for tk_p, pos in portfolio.items():
                df_p = load_price_data(tk_p, "1mo")
                if df_p.empty: continue
                p = to_eur(scalar(df_p["Close"].iloc[-1]), tk_p, eurusd)
                pie_labels.append(pos["nom"]); pie_vals.append(p * pos["quantite"])

            fig_pie = go.Figure(go.Pie(labels=pie_labels, values=pie_vals, hole=0.4,
                textinfo="label+percent"))
            fig_pie.update_layout(title="Répartition du portefeuille", template="plotly_dark",
                margin=dict(l=10,r=10,t=50,b=10))
            st.plotly_chart(fig_pie, use_container_width=True)

            st.subheader("Évolution de la valeur")
            with st.spinner("Calcul en cours…"):
                portfolio_ts = None
                for tk_p, pos in portfolio.items():
                    df_h = load_price_data(tk_p, "1y")
                    if df_h.empty: continue
                    series = df_h["Close"].apply(lambda p: to_eur(float(p), tk_p, eurusd)) * pos["quantite"]
                    portfolio_ts = series if portfolio_ts is None else portfolio_ts.add(series, fill_value=0)

            if portfolio_ts is not None:
                invest_line = sum(pos["quantite"] * pos["prix_achat"] for pos in portfolio.values())
                fig_ts = go.Figure()
                fig_ts.add_trace(go.Scatter(x=portfolio_ts.index, y=portfolio_ts.values,
                    name="Valeur du portefeuille", fill="tozeroy",
                    line=dict(color="#26a69a", width=2),
                    fillcolor="rgba(38,166,154,0.15)"))
                fig_ts.add_hline(y=invest_line, line_dash="dash", line_color="#ffa726",
                    annotation_text="Montant investi")
                fig_ts.update_layout(template="plotly_dark", height=400,
                    yaxis_title="Valeur (€)", margin=dict(l=10,r=10,t=30,b=10))
                st.plotly_chart(fig_ts, use_container_width=True)

                st.divider()
                st.subheader("📊 Métriques de risque")
                daily_ret = portfolio_ts.pct_change().dropna()
                ann_vol   = float(daily_ret.std()) * (252 ** 0.5) * 100
                total_ret = (float(portfolio_ts.iloc[-1]) / float(portfolio_ts.iloc[0]) - 1) * 100
                n_days    = len(portfolio_ts)
                ann_ret   = ((1 + total_ret / 100) ** (252 / max(n_days, 1)) - 1) * 100
                sharpe    = (ann_ret - 3.0) / ann_vol if ann_vol > 0 else 0

                rolling_max = portfolio_ts.cummax()
                drawdown    = (portfolio_ts - rolling_max) / rolling_max * 100
                max_dd      = float(drawdown.min())

                spy_df  = load_price_data("SPY", "1y")
                spy_ret = 0.0
                if not spy_df.empty:
                    spy_ret = (float(spy_df["Close"].iloc[-1]) / float(spy_df["Close"].iloc[0]) - 1) * 100

                r1, r2, r3, r4 = st.columns(4)
                r1.metric("Volatilité annualisée", f"{ann_vol:.1f}%")
                r2.metric("Sharpe ratio", f"{sharpe:.2f}",
                          help="(Rendement annualisé − 3%) / Volatilité. > 1 = bon, > 2 = excellent")
                r3.metric("Drawdown maximum", f"{max_dd:.1f}%")
                alpha = total_ret - spy_ret
                r4.metric("vs S&P 500 (SPY)", f"{alpha:+.1f}%",
                          f"Portf. {total_ret:+.1f}% · SPY {spy_ret:+.1f}%")

                fig_dd = go.Figure()
                fig_dd.add_trace(go.Scatter(x=drawdown.index, y=drawdown.values,
                    fill="tozeroy", line=dict(color="#ef5350", width=1.5),
                    fillcolor="rgba(239,83,80,0.15)", name="Drawdown"))
                fig_dd.update_layout(template="plotly_dark", height=220,
                    title="Drawdown (%)", yaxis_title="%",
                    margin=dict(l=10, r=10, t=40, b=10))
                st.plotly_chart(fig_dd, use_container_width=True)


# ─────────────────────────────────────────────────────────────────────────────
# PAGE : BACKTESTING
# ─────────────────────────────────────────────────────────────────────────────
elif page == "Backtesting":
    st.title("Backtesting — Tester une stratégie")
    st.caption("Simule une stratégie sur des données historiques et compare avec le buy-and-hold.")

    col_s, col_p = st.columns([2,1])
    with col_s:
        bt_sel    = st.selectbox("Action à tester", list(active_tickers.keys()))
        bt_ticker = active_tickers[bt_sel]
    with col_p:
        bt_period = st.selectbox("Période", ["6 mois","1 an","2 ans"], index=1)
    bt_period_code = {"6 mois": "6mo", "1 an": "1y", "2 ans": "2y"}[bt_period]

    st.markdown("#### Paramètres de la stratégie")
    sc1, sc2, sc3 = st.columns(3)
    strategy = sc1.selectbox("Stratégie", ["RSI seul", "MACD seul", "RSI + MACD (combiné)"])
    rsi_buy  = sc2.slider("RSI seuil achat", 10, 40, 30)
    rsi_sell = sc3.slider("RSI seuil vente", 60, 90, 70)
    capital  = st.number_input("Capital initial (€)", min_value=100.0, value=1000.0, step=100.0)

    if st.button("▶️ Lancer le backtesting", type="primary"):
        with st.spinner("Calcul…"):
            df_bt = load_price_data(bt_ticker, bt_period_code)
            if df_bt.empty: st.error("Données indisponibles."); st.stop()
            fx    = 1.0 if get_ticker_currency(bt_ticker) == "EUR" else 1.0/eurusd
            close = df_bt["Close"] * fx
            rsi_s, macd_s, msig_s = df_bt["RSI"], df_bt["MACD"], df_bt["MACD_signal"]

            cash, shares, trades = capital, 0.0, []
            equity = []

            for i in range(len(close)):
                p   = float(close.iloc[i])
                r   = float(rsi_s.iloc[i])  if not pd.isna(rsi_s.iloc[i])  else 50
                mc  = float(macd_s.iloc[i]) if not pd.isna(macd_s.iloc[i]) else 0
                mcs = float(msig_s.iloc[i]) if not pd.isna(msig_s.iloc[i]) else 0

                if strategy == "RSI seul":
                    buy_sig  = r < rsi_buy
                    sell_sig = r > rsi_sell
                elif strategy == "MACD seul":
                    prev_mc  = float(macd_s.iloc[i-1]) if i > 0 and not pd.isna(macd_s.iloc[i-1]) else mc
                    prev_mcs = float(msig_s.iloc[i-1]) if i > 0 and not pd.isna(msig_s.iloc[i-1]) else mcs
                    buy_sig  = mc > mcs and prev_mc <= prev_mcs
                    sell_sig = mc < mcs and prev_mc >= prev_mcs
                else:
                    buy_sig  = r < rsi_buy and mc > mcs
                    sell_sig = r > rsi_sell and mc < mcs

                if buy_sig and cash > 0:
                    shares = cash / p; cash = 0
                    trades.append({"date": df_bt.index[i].strftime("%d/%m/%Y"),
                                   "action": "Achat", "prix": round(p,2), "shares": round(shares,4)})
                elif sell_sig and shares > 0:
                    cash = shares * p; shares = 0
                    trades.append({"date": df_bt.index[i].strftime("%d/%m/%Y"),
                                   "action": "Vente", "prix": round(p,2), "montant": round(cash,2)})
                equity.append(cash + shares * p)

        final_val = equity[-1]
        total_ret = (final_val - capital) / capital * 100
        bh_ret    = (float(close.iloc[-1]) - float(close.iloc[0])) / float(close.iloc[0]) * 100
        n_trades  = len(trades)

        m1,m2,m3,m4 = st.columns(4)
        m1.metric("Valeur finale", f"{final_val:,.2f} €", f"{total_ret:+.2f}%")
        m2.metric("Buy-and-hold", f"{capital*(1+bh_ret/100):,.2f} €", f"{bh_ret:+.2f}%")
        m3.metric("Nombre de trades", n_trades)
        delta_vs_bh = total_ret - bh_ret
        m4.metric("vs Buy-and-hold", f"{delta_vs_bh:+.2f}%",
                  "✓ Stratégie gagnante" if delta_vs_bh > 0 else "✗ Buy-and-hold meilleur")

        fig_bt = make_subplots(rows=2, cols=1, shared_xaxes=True,
                               row_heights=[0.65, 0.35], vertical_spacing=0.05,
                               subplot_titles=("Equity curve", "Prix + RSI"))
        fig_bt.add_trace(go.Scatter(x=df_bt.index, y=equity, name="Stratégie",
            line=dict(color="#26a69a", width=2), fill="tozeroy",
            fillcolor="rgba(38,166,154,0.15)"), row=1, col=1)
        bh_curve = [capital * float(close.iloc[i]) / float(close.iloc[0]) for i in range(len(close))]
        fig_bt.add_trace(go.Scatter(x=df_bt.index, y=bh_curve, name="Buy & Hold",
            line=dict(color="#ffa726", width=1.5, dash="dot")), row=1, col=1)

        for t in trades:
            try:
                dt  = datetime.strptime(t["date"], "%d/%m/%Y")
                idx = df_bt.index.get_indexer([dt], method="nearest")[0]
                eq_val = equity[idx]
                color  = "#00c853" if t["action"] == "Achat" else "#ef5350"
                symbol = "triangle-up" if t["action"] == "Achat" else "triangle-down"
                fig_bt.add_trace(go.Scatter(x=[df_bt.index[idx]], y=[eq_val],
                    mode="markers", marker=dict(color=color, size=12, symbol=symbol),
                    name=t["action"], showlegend=False), row=1, col=1)
            except Exception: pass

        fig_bt.add_trace(go.Scatter(x=df_bt.index, y=close, name="Prix (€)",
            line=dict(color="#90a4ae", width=1.5)), row=2, col=1)
        fig_bt.add_trace(go.Scatter(x=df_bt.index, y=df_bt["RSI"], name="RSI",
            line=dict(color="#ce93d8", width=1.5)), row=2, col=1)
        fig_bt.add_hline(y=rsi_buy,  line_dash="dash", line_color="#26a69a", row=2, col=1)
        fig_bt.add_hline(y=rsi_sell, line_dash="dash", line_color="#ef5350", row=2, col=1)
        fig_bt.update_layout(height=650, template="plotly_dark",
            legend=dict(orientation="h", y=1.02), margin=dict(l=10,r=10,t=40,b=10))
        st.plotly_chart(fig_bt, use_container_width=True)

        if trades:
            st.subheader(f"Trades exécutés ({n_trades})")
            df_trades = pd.DataFrame(trades)
            def hl_trade(row):
                if row["action"] == "Achat": return ["background-color:#1b5e20;color:white"]*len(row)
                return ["background-color:#b71c1c;color:white"]*len(row)
            st.dataframe(df_trades.style.apply(hl_trade, axis=1), use_container_width=True, hide_index=True)
        else:
            st.info("Aucun trade exécuté avec ces paramètres. Essaie d'ajuster les seuils RSI.")


# ─────────────────────────────────────────────────────────────────────────────
# PAGE : ALERTES
# ─────────────────────────────────────────────────────────────────────────────
elif page == "Alertes":
    st.title("Alertes Prix")
    alerts = get_alerts()

    with st.expander("Créer une alerte", expanded=True):
        sel_a    = st.selectbox("Action", list(active_tickers.keys()), key="alert_sel")
        ticker_a = active_tickers[sel_a]
        df_a     = load_price_data(ticker_a, "1mo")
        cur_p    = to_eur(scalar(df_a["Close"].iloc[-1]), ticker_a, eurusd) if not df_a.empty else 0.0
        st.info(f"Prix actuel : **{cur_p:.2f} €**")
        ca, cb = st.columns(2)
        seuil_bas  = ca.number_input("Seuil achat ≤ (€)", min_value=0.0, step=0.5, value=round(cur_p*0.95,2))
        seuil_haut = cb.number_input("Seuil vente ≥ (€)", min_value=0.0, step=0.5, value=round(cur_p*1.05,2))
        if st.button("Enregistrer l'alerte"):
            upsert_alert(ticker_a, sel_a, seuil_bas or None, seuil_haut or None)
            st.success(f"Alerte enregistrée pour {sel_a}."); st.rerun()

    st.divider(); st.subheader("Alertes actives")
    if not alerts:
        st.info("Aucune alerte configurée.")
    else:
        rows_a = []
        for tk_a, a in alerts.items():
            df_a2 = load_price_data(tk_a, "1mo")
            p_a   = to_eur(scalar(df_a2["Close"].iloc[-1]), tk_a, eurusd) if not df_a2.empty else None
            status = "—"
            if p_a and a.get("seuil_bas") and p_a <= a["seuil_bas"]: status = "🟢 ACHAT déclenché"
            elif p_a and a.get("seuil_haut") and p_a >= a["seuil_haut"]: status = "🔴 VENTE déclenchée"
            rows_a.append({"Action": a.get("nom", tk_a), "Ticker": tk_a,
                "Prix (€)": round(p_a,2) if p_a else "—",
                "Seuil achat (€)": a.get("seuil_bas","—"),
                "Seuil vente (€)": a.get("seuil_haut","—"), "Statut": status})
        st.dataframe(pd.DataFrame(rows_a), use_container_width=True, hide_index=True)
        st.divider()
        to_del_a = st.selectbox("Supprimer", ["—"] + list(alerts.keys()))
        if st.button("Supprimer l'alerte") and to_del_a != "—":
            delete_alert(to_del_a); st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
# PAGE : PARAMÈTRES
# ─────────────────────────────────────────────────────────────────────────────
elif page == "Paramètres":
    st.title("Paramètres")
    tg = st.session_state.tg_config

    st.markdown("### Telegram")
    st.markdown("1. Telegram → **@BotFather** → `/newbot` → copie le token\n"
                "2. **@userinfobot** → `/start` → copie ton Chat ID")
    tg_token = st.text_input("Token du bot", value=tg.get("token",""), key="input_tg_token")
    tg_chat  = st.text_input("Chat ID",      value=tg.get("chat_id",""), key="input_tg_chat")
    cs, ct   = st.columns(2)
    with cs:
        if st.button("Enregistrer"):
            save_tg_config(tg_token, tg_chat)
            st.session_state.tg_config = {"token": tg_token, "chat_id": tg_chat}
            st.success("Enregistré.")
    with ct:
        if st.button("📱 Tester"):
            try:
                url  = f"https://api.telegram.org/bot{tg_token}/sendMessage"
                data = urllib.parse.urlencode({"chat_id": tg_chat,
                    "text": "✅ <b>Stock Analyzer fonctionne !</b>", "parse_mode": "HTML"}).encode()
                urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=10)
                save_tg_config(tg_token, tg_chat)
                st.session_state.tg_config = {"token": tg_token, "chat_id": tg_chat}
                st.success("Message envoyé !")
            except Exception as e: st.error(f"Erreur : {e}")

    st.divider()
    st.markdown("### 📋 Watchlist personnalisée")
    st.caption("Ajoute des actions absentes de la liste par défaut.")
    wl_custom = get_custom_watchlist()

    wl_col1, wl_col2 = st.columns(2)
    with wl_col1:
        wl_name   = st.text_input("Nom de l'action", placeholder="ex: Stellantis", key="wl_name")
        wl_ticker = st.text_input("Ticker Yahoo Finance", placeholder="ex: STLAM.MI", key="wl_ticker")
        if st.button("➕ Ajouter à la watchlist"):
            t = wl_ticker.strip().upper()
            if t:
                label = wl_name.strip() or t
                upsert_custom_ticker(label, t)
                st.success(f"**{label}** ({t}) ajouté."); st.rerun()
            else:
                st.warning("Saisis un ticker valide.")

    with wl_col2:
        if wl_custom:
            st.markdown("**Actions personnalisées :**")
            for nm, tk in list(wl_custom.items()):
                col_a, col_b = st.columns([4, 1])
                col_a.markdown(f"**{nm}** — `{tk}`")
                if col_b.button("🗑️", key=f"wldel_{tk}"):
                    delete_custom_ticker(nm); st.rerun()
        else:
            st.caption("Aucune action ajoutée pour le moment.")
