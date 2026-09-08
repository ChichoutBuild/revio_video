-- Migration 001 — Tables d'identité (organisations, utilisateurs, codes, appareils)
-- Correspond à la section B.1 de l'architecture v2.1.
--
-- Important : RLS est activé sur toutes ces tables, mais AUCUNE policy n'est
-- encore créée. Résultat attendu et volontaire : personne ne peut lire ni
-- écrire ces tables depuis le navigateur (clé "anon") tant qu'on n'a pas
-- ajouté de vraies policies — seule la clé "service_role", utilisée
-- uniquement côté serveur, peut y accéder pour l'instant. On vérifiera ça
-- concrètement à l'étape de test.

create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table association_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  token_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index on association_tokens(organization_id) where is_active;

-- Note : "id" a un défaut généré pour l'instant afin de pouvoir tester cette
-- table indépendamment. Quand on construira le vrai flux d'authentification
-- (prochaine étape), "id" sera systématiquement fourni explicitement pour
-- correspondre à l'identifiant du compte Supabase Auth créé côté serveur.
create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  display_name text not null,
  status text not null default 'PENDING_ACTIVATION'
    check (status in ('PENDING_ACTIVATION', 'ACTIVE', 'DISABLED')),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index on users(organization_id);

create table activation_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempt_count int not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on activation_codes(user_id) where used_at is null;

create table user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null,
  platform text not null default 'web',
  push_token text,
  is_revoked boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, session_id)
);
create index on user_devices(user_id) where not is_revoked;
create unique index on user_devices(push_token) where push_token is not null;

-- Activation de RLS — aucune policy pour l'instant, donc fermé par défaut.
alter table organizations enable row level security;
alter table association_tokens enable row level security;
alter table users enable row level security;
alter table activation_codes enable row level security;
alter table user_devices enable row level security;
