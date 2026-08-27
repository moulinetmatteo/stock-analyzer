-- Déduplication des alertes prix. À exécuter dans Supabase → SQL Editor.
--
-- Sans cette colonne, une alerte dont le seuil reste franchi renvoie une
-- notification à chaque passage du cron, soit toutes les 30 minutes.
-- Colonne nullable : l'ancienne app Streamlit continue de fonctionner.

alter table alerts add column if not exists notified_date text;
