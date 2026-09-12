-- Migration 008 — Groupes de vérificateurs, accès vidéo par groupe, historique consultable

-- --- Colonne manquante : groupe auto-maintenu "Tout le monde" -------------
alter table user_groups add column if not exists is_auto boolean not null default false;

-- --- Fonctions de vérification (même principe que has_permission/can_view_video) ---

create or replace function can_view_org(p_organization_id uuid, p_user_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from users u
    where u.id = p_user_id and u.status = 'ACTIVE' and u.organization_id = p_organization_id
  );
$$;
grant execute on function can_view_org(uuid, uuid) to authenticated, service_role;

create or replace function can_manage_org(p_organization_id uuid, p_user_id uuid)
returns boolean language sql stable security definer as $$
  select can_view_org(p_organization_id, p_user_id) and has_permission(p_user_id, 'ROLES_MANAGE');
$$;
grant execute on function can_manage_org(uuid, uuid) to authenticated, service_role;

create or replace function can_view_group(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from user_groups g where g.id = p_group_id and can_view_org(g.organization_id, p_user_id));
$$;
grant execute on function can_view_group(uuid, uuid) to authenticated, service_role;

-- "not g.is_auto" : le groupe automatique "Tout le monde" ne peut jamais être
-- édité manuellement, même par un admin — seul le serveur (service_role, qui
-- contourne RLS) peut y ajouter des membres, au moment de la création d'un
-- utilisateur.
create or replace function can_manage_group(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from user_groups g
    where g.id = p_group_id and not g.is_auto and can_manage_org(g.organization_id, p_user_id)
  );
$$;
grant execute on function can_manage_group(uuid, uuid) to authenticated, service_role;

create or replace function can_manage_video(p_video_id uuid, p_user_id uuid)
returns boolean language sql stable security definer as $$
  select can_view_video(p_video_id, p_user_id) and has_permission(p_user_id, 'VIDEOS_ASSIGN');
$$;
grant execute on function can_manage_video(uuid, uuid) to authenticated, service_role;

-- --- Policies : profils utilisateurs de l'organisation (nécessaire pour --
-- --- l'UI d'administration : lister qui peut être ajouté à un groupe)   --
drop policy if exists "users select same org" on users;
create policy "users select same org" on users
  for select using (can_view_org(organization_id, auth.uid()));

-- --- Policies : groupes ------------------------------------------------
drop policy if exists "user_groups select" on user_groups;
create policy "user_groups select" on user_groups
  for select using (can_view_org(organization_id, auth.uid()));

drop policy if exists "user_groups insert" on user_groups;
create policy "user_groups insert" on user_groups
  for insert with check (can_manage_org(organization_id, auth.uid()));

drop policy if exists "user_groups delete" on user_groups;
create policy "user_groups delete" on user_groups
  for delete using (can_manage_org(organization_id, auth.uid()) and not is_auto);

drop policy if exists "user_group_members select" on user_group_members;
create policy "user_group_members select" on user_group_members
  for select using (can_view_group(group_id, auth.uid()));

drop policy if exists "user_group_members insert" on user_group_members;
create policy "user_group_members insert" on user_group_members
  for insert with check (can_manage_group(group_id, auth.uid()));

drop policy if exists "user_group_members delete" on user_group_members;
create policy "user_group_members delete" on user_group_members
  for delete using (can_manage_group(group_id, auth.uid()));

-- --- Policies : accès vidéo (assignation de vérificateurs) -------------
drop policy if exists "video_access select" on video_access;
create policy "video_access select" on video_access
  for select using (can_view_video(video_id, auth.uid()));

drop policy if exists "video_access insert" on video_access;
create policy "video_access insert" on video_access
  for insert with check (can_manage_video(video_id, auth.uid()));

drop policy if exists "video_access delete" on video_access;
create policy "video_access delete" on video_access
  for delete using (can_manage_video(video_id, auth.uid()));

-- --- Policy : historique consultable -------------------------------------
drop policy if exists "activity_logs select" on activity_logs;
create policy "activity_logs select" on activity_logs
  for select using (
    (entity_type = 'video_version' and can_view_video_version(entity_id, auth.uid()))
    or (entity_type = 'video' and can_view_video(entity_id, auth.uid()))
  );

-- --- Rattrapage pour les organisations déjà existantes -------------------
-- (même principe que la migration 005 pour les catégories de feedback :
-- toute fonctionnalité nouvelle doit aussi couvrir les données déjà créées)

insert into user_groups (organization_id, name, is_auto)
select o.id, 'Tout le monde', true
from organizations o
where not exists (
  select 1 from user_groups g where g.organization_id = o.id and g.is_auto = true
);

insert into user_group_members (group_id, user_id)
select g.id, u.id
from users u
join user_groups g on g.organization_id = u.organization_id and g.is_auto = true
on conflict (group_id, user_id) do nothing;
