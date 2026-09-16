-- Migration 015 — Niveau de priorité (0-3) + date estimée de publication
--
-- La migration 003 avait pré-réservé une colonne priority (text enum 3 valeurs)
-- et estimated_publish_at (timestamptz), mais elles n'étaient jamais lues ni
-- écrites côté code. On les remplace par des champs plus simples et
-- directement utilisés par l'API et le dashboard :
--   - priority : smallint 0-3 (0 = pas important, 3 = urgent)
--   - estimated_publish_date : date, NULL = "dès que possible"
-- L'index sert au tri par défaut du dashboard.

alter table videos
  drop column if exists priority,
  drop column if exists estimated_publish_at;

alter table videos
  add column if not exists priority smallint not null default 0
    check (priority between 0 and 3);

alter table videos
  add column if not exists estimated_publish_date date;

-- Index utilisé pour le tri par défaut du dashboard :
-- vidéos "dès que possible" (NULL) d'abord, puis par priorité décroissante,
-- puis par date de création décroissante.
create index if not exists videos_priority_publish_date_idx
  on videos (estimated_publish_date asc nulls first, priority desc, created_at desc);
