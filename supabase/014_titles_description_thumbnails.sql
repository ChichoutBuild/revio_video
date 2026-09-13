-- Migration 014 — Description, titres alternatifs, miniatures alternatives
--
-- "notes" existe déjà sur la table "videos" depuis la migration 003 — il ne
-- manquait que l'interface, ajoutée dans cette étape.

alter table video_versions add column if not exists description text;

create table video_title_options (
  id uuid primary key default gen_random_uuid(),
  video_version_id uuid not null references video_versions(id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C')),
  title text not null,
  created_at timestamptz not null default now(),
  unique (video_version_id, label)
);
alter table video_title_options enable row level security;
create policy "video_title_options select" on video_title_options
  for select using (can_view_video_version(video_version_id, auth.uid()));
-- Pas de policy insert/update/delete pour "authenticated" : passe par le
-- serveur (vérification VIDEOS_EDIT), comme les groupes/accès vidéo.

create table video_thumbnail_options (
  id uuid primary key default gen_random_uuid(),
  video_version_id uuid not null references video_versions(id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (video_version_id, label)
);
alter table video_thumbnail_options enable row level security;
create policy "video_thumbnail_options select" on video_thumbnail_options
  for select using (can_view_video_version(video_version_id, auth.uid()));

-- Bucket de stockage PRIVÉ pour les fichiers de miniatures. L'upload et la
-- génération d'URL passent exclusivement par le serveur (service_role) —
-- pas de policy storage.objects pour "authenticated", cohérent avec le choix
-- déjà fait pour la gestion des groupes/accès vidéo.
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', false)
on conflict (id) do nothing;
