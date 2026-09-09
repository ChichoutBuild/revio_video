-- Migration 002 — Système de permissions (section 4 de l'architecture v2.1)

create table roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  is_system boolean not null default false,
  unique (organization_id, name)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- granted = true  -> octroi individuel (en plus des rôles)
-- granted = false -> retrait individuel explicite (priorité absolue, même sur un rôle)
create table user_permissions (
  user_id uuid not null references users(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  granted boolean not null default true,
  granted_by uuid references users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table user_permissions enable row level security;

-- Catalogue des permissions (global, pas par organisation).
insert into permissions (code) values
  ('VIDEOS_VIEW'), ('VIDEOS_VIEW_ALL'), ('VIDEOS_CREATE'), ('VIDEOS_EDIT'),
  ('VIDEOS_DELETE'), ('VIDEOS_ASSIGN'), ('VIDEOS_CREATE_VERSION'),
  ('FEEDBACK_CREATE'), ('FEEDBACK_REPLY'), ('FEEDBACK_RESOLVE'),
  ('USERS_VIEW'), ('USERS_CREATE'), ('USERS_EDIT'), ('USERS_DISABLE'),
  ('STATISTICS_VIEW'), ('SETTINGS_MANAGE'), ('ROLES_MANAGE'),
  ('NOTIFICATIONS_MANAGE')
on conflict (code) do nothing;

-- Claim JWT standard "session_id", exposé par Supabase Auth sur chaque session.
create or replace function current_session_id() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

-- Tant qu'aucun appareil n'est enregistré pour cette session (fonctionnalité
-- pas encore construite), on considère la session active par défaut — ce
-- sera resserré quand on ajoutera l'enregistrement des appareils.
create or replace function session_is_active() returns boolean
language sql stable security definer
as $$
  select not exists (
    select 1 from user_devices d
    where d.session_id = current_session_id() and d.is_revoked
  );
$$;

-- Priorité : DENY individuel > ALLOW individuel > ALLOW via rôle > DENY par défaut
-- (voir architecture v2.1 section 4).
create or replace function has_permission(p_user_id uuid, p_permission_code text)
returns boolean
language sql stable security definer
as $$
  with base as (
    select u.status = 'ACTIVE' as user_active
    from users u where u.id = p_user_id
  ),
  individual_deny as (
    select true as v from user_permissions up
    join permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and p.code = p_permission_code and up.granted = false
  ),
  individual_allow as (
    select true as v from user_permissions up
    join permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and p.code = p_permission_code and up.granted = true
  ),
  role_allow as (
    select true as v from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.user_id = p_user_id and p.code = p_permission_code
  )
  select coalesce((select user_active from base), false)
     and session_is_active()
     and not exists (select 1 from individual_deny)
     and (exists (select 1 from individual_allow) or exists (select 1 from role_allow));
$$;

grant execute on function has_permission(uuid, text) to authenticated, service_role;
grant execute on function session_is_active() to authenticated, service_role;
