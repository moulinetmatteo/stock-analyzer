-- Candidats à l'achat. À exécuter dans Supabase → SQL Editor.
--
-- prix_ajout fige le cours du jour où le titre est mis sous surveillance.
-- Sans lui, impossible de savoir six mois plus tard si l'intuition était bonne :
-- c'est ce qui transforme une liste d'envies en boucle d'apprentissage.

create table if not exists candidates (
  id          uuid default gen_random_uuid() primary key,
  user_id     text not null,
  ticker      text not null,
  nom         text,
  these       text default '',
  prix_cible  float,
  prix_ajout  float,
  conviction  int  default 2,            -- 1 tiède · 2 intéressé · 3 convaincu
  statut      text default 'surveille',  -- surveille | achete | abandonne
  note_sortie text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, ticker)
);

create index if not exists candidates_lookup on candidates (user_id, statut);
