-- Migration 003 — Vidéos, versions, accès (sections B.3, E et F de l'architecture v2.1)

create table user_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null
);

create table user_group_members (
  group_id uuid not null references user_groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (group_id, user_id)
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text not null default 'LONG',
  priority text not null default 'normale' check (priority in ('normale', 'importante', 'urgente')),
  estimated_publish_at timestamptz,
  notes text,
  created_by uuid not null references users(id),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index on videos(organization_id);

create table video_versions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  version_number int not null,
  status text not null default 'BROUILLON'
    check (status in ('BROUILLON', 'A_VERIFIER', 'EN_VERIFICATION', 'MODIFICATIONS_DEMANDEES', 'APPROUVEE', 'PUBLIEE', 'ARCHIVEE')),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (video_id, version_number)
);
create index on video_versions(video_id);

alter table videos
  add constraint videos_current_version_id_fkey
  foreign key (current_version_id) references video_versions(id);

create table video_access (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  scope_type text not null check (scope_type in ('ALL_TEAM', 'ROLE', 'USER', 'GROUP')),
  role_id uuid references roles(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  group_id uuid references user_groups(id) on delete cascade,
  check (
    (scope_type = 'ALL_TEAM' and role_id is null and user_id is null and group_id is null) or
    (scope_type = 'ROLE' and role_id is not null) or
    (scope_type = 'USER' and user_id is not null) or
    (scope_type = 'GROUP' and group_id is not null)
  )
);
create index on video_access(video_id);

alter table user_groups enable row level security;
alter table user_group_members enable row level security;
alter table videos enable row level security;
alter table video_versions enable row level security;
alter table video_access enable row level security;

-- IMPORTANT : cette fonction est en SECURITY DEFINER, donc elle bypasse RLS
-- en interne pour lire video_access/user_roles/user_group_members. Sans ça,
-- la policy sur "videos" ci-dessous ne verrait JAMAIS aucune ligne dans
-- video_access (RLS y est activé sans policy dédiée), et personne ne
-- pourrait jamais voir une vidéo, même en ALL_TEAM. C'est le même principe
-- que has_permission() dans la migration 002.
create or replace function can_view_video(p_video_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (select 1 from users u where u.id = p_user_id and u.status = 'ACTIVE')
  and (
    exists (select 1 from videos v where v.id = p_video_id and v.created_by = p_user_id)
    or has_permission(p_user_id, 'VIDEOS_VIEW_ALL')
    or exists (
      select 1 from video_access va
      where va.video_id = p_video_id and (
        va.scope_type = 'ALL_TEAM'
        or (va.scope_type = 'ROLE' and va.role_id in (select role_id from user_roles where user_id = p_user_id))
        or (va.scope_type = 'USER' and va.user_id = p_user_id)
        or (va.scope_type = 'GROUP' and va.group_id in (select group_id from user_group_members where user_id = p_user_id))
      )
    )
  );
$$;

grant execute on function can_view_video(uuid, uuid) to authenticated, service_role;

create policy "video visibility" on videos
  for select using (can_view_video(id, auth.uid()));

create policy "video version visibility" on video_versions
  for select using (can_view_video(video_id, auth.uid()));

-- Pas de policy insert/update pour "authenticated" : la création de vidéos
-- passe uniquement par l'API serveur (service_role), qui vérifie déjà
-- VIDEOS_CREATE avant d'écrire — cohérent avec le principe "RLS = fermé par
-- défaut, on n'ouvre que ce qui est nécessaire".
