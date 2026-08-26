-- Coller dans Supabase → SQL Editor → Run

create table if not exists portfolio (
  id          uuid default gen_random_uuid() primary key,
  user_id     text not null,
  ticker      text not null,
  nom         text,
  quantite    float not null,
  prix_achat  float not null,
  unique (user_id, ticker)
);

create table if not exists transactions (
  id          text primary key,
  user_id     text not null,
  date        text not null,
  ticker      text not null,
  nom         text,
  action      text not null,
  quantite    float not null,
  prix        float not null,
  montant     float not null,
  created_at  timestamptz default now()
);

create table if not exists alerts (
  id          uuid default gen_random_uuid() primary key,
  user_id     text not null,
  ticker      text not null,
  nom         text,
  seuil_bas   float,
  seuil_haut  float,
  unique (user_id, ticker)
);

create table if not exists watchlist_custom (
  id       uuid default gen_random_uuid() primary key,
  user_id  text not null,
  nom      text not null,
  ticker   text not null,
  unique (user_id, nom)
);

create table if not exists telegram_config (
  user_id  text primary key,
  token    text,
  chat_id  text
);

create table if not exists rsi_state (
  user_id       text not null,
  ticker        text not null,
  zone          text default 'neutral',
  alerted_date  text default '',
  unique (user_id, ticker)
);
