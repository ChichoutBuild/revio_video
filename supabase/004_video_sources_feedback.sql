-- Migration 004 — Source vidéo (YouTube) + système de feedback

create table video_sources (
  id uuid primary key default gen_random_uuid(),
  video_version_id uuid not null references video_versions(id) on delete cascade,
  type text not null check (type in ('YOUTUBE', 'PRIVATE_STORAGE')),
  external_id text not null,
  duration_seconds int,
  raw_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (video_version_id)
);

create table feedback_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null,
  icon text,
  sort_order int not null default 0,
  is_blocking boolean not null default false,
  unique (organization_id, name)
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  video_version_id uuid not null references video_versions(id) on delete cascade,
  author_id uuid not null references users(id),
  category_id uuid not null references feedback_categories(id),
  type text not null check (type in ('TIMECODE', 'RANGE', 'GLOBAL')),
  start_time_seconds numeric check (start_time_seconds >= 0),
  end_time_seconds numeric check (end_time_seconds >= start_time_seconds),
  content text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  check (
    (type = 'GLOBAL' and start_time_seconds is null and end_time_seconds is null) or
    (type = 'TIMECODE' and start_time_seconds is not null and end_time_seconds is null) or
    (type = 'RANGE' and start_time_seconds is not null and end_time_seconds is not null)
  )
);
create index on feedback(video_version_id, status);

create table feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  author_id uuid not null references users(id),
  content text not null,
  created_at timestamptz not null default now()
);
create index on feedback_replies(feedback_id, created_at);

alter table video_sources enable row level security;
alter table feedback_categories enable row level security;
alter table feedback enable row level security;
alter table feedback_replies enable row level security;

-- Même principe que can_view_video (migration 003) : SECURITY DEFINER pour
-- éviter les pièges de RLS en cascade lors des vérifications indirectes.
create or replace function can_view_video_version(p_video_version_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from video_versions vv
    where vv.id = p_video_version_id and can_view_video(vv.video_id, p_user_id)
  );
$$;
grant execute on function can_view_video_version(uuid, uuid) to authenticated, service_role;

create policy "video source visibility" on video_sources
  for select using (can_view_video_version(video_version_id, auth.uid()));

create policy "feedback categories visibility" on feedback_categories
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.status = 'ACTIVE' and u.organization_id = feedback_categories.organization_id
    )
  );

create policy "feedback visibility" on feedback
  for select using (can_view_video_version(video_version_id, auth.uid()));

-- Contrairement aux vidéos, le feedback peut être créé directement depuis le
-- navigateur (protégé par RLS), pas uniquement via l'API serveur — c'est une
-- action collaborative normale, pas une opération d'administration sensible.
create policy "feedback insert" on feedback
  for insert with check (
    author_id = auth.uid()
    and has_permission(auth.uid(), 'FEEDBACK_CREATE')
    and can_view_video_version(video_version_id, auth.uid())
  );

create policy "feedback_replies visibility" on feedback_replies
  for select using (
    exists (
      select 1 from feedback f
      where f.id = feedback_replies.feedback_id and can_view_video_version(f.video_version_id, auth.uid())
    )
  );

create policy "feedback_replies insert" on feedback_replies
  for insert with check (
    author_id = auth.uid()
    and has_permission(auth.uid(), 'FEEDBACK_REPLY')
    and exists (
      select 1 from feedback f
      where f.id = feedback_replies.feedback_id and can_view_video_version(f.video_version_id, auth.uid())
    )
  );

-- Pas de policy UPDATE sur "feedback" pour "authenticated" : la résolution
-- (statut, resolved_by, resolved_at) passe par l'API serveur uniquement — une
-- policy RLS ne peut pas restreindre QUELLES colonnes sont modifiées, or on
-- ne veut permettre de changer QUE le statut de résolution, pas le contenu.
