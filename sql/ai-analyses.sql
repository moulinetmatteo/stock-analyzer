-- Cache des analyses IA. À exécuter dans Supabase → SQL Editor.
--
-- Une seule ligne par (utilisateur, titre, période) : une nouvelle analyse
-- remplace la précédente. La fraîcheur est décidée côté application à partir de
-- created_at, ce qui permet de changer le délai sans toucher au schéma.

create table if not exists ai_analyses (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  ticker     text not null,
  periode    text not null,
  content    text not null,
  price_eur  float,
  created_at timestamptz default now(),
  unique (user_id, ticker, periode)
);

create index if not exists ai_analyses_lookup
  on ai_analyses (user_id, ticker, periode);
