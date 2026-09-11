-- Migration 006 — Corrections de sécurité importantes
--
-- 1. FUITE ENTRE ORGANISATIONS (grave) : can_view_video() ne vérifiait jamais
--    que la vidéo appartenait à la MÊME organisation que l'utilisateur. Un
--    accès "ALL_TEAM" (par défaut sur chaque vidéo) ou la permission
--    VIDEOS_VIEW_ALL étaient donc valables pour n'importe quel utilisateur
--    actif, même d'une autre organisation. Corrigé : l'appartenance à la
--    même organisation est maintenant une condition obligatoire, quelle que
--    soit la raison d'accès.
--
-- 2. CATÉGORIES DE RETOURS TOUJOURS VIDES : la policy de "feedback_categories"
--    lisait directement la table "users" (protégée par RLS, sans policy de
--    lecture pour "authenticated"), donc sa vérification échouait toujours,
--    même quand les catégories existaient bel et bien en base. Corrigé en
--    passant par une fonction SECURITY DEFINER, comme has_permission() et
--    can_view_video() ailleurs dans le projet.

create or replace function can_view_video(p_video_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1
    from users u
    join videos v on v.organization_id = u.organization_id
    where u.id = p_user_id and u.status = 'ACTIVE' and v.id = p_video_id
  )
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
-- "create or replace" garde le même nom de fonction : toutes les policies qui
-- l'utilisent déjà (video visibility, video version visibility, video source
-- visibility, feedback visibility...) profitent de la correction automatiquement,
-- sans rien changer d'autre.

create or replace function can_view_org_feedback_categories(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from users u
    where u.id = p_user_id and u.status = 'ACTIVE' and u.organization_id = p_organization_id
  );
$$;
grant execute on function can_view_org_feedback_categories(uuid, uuid) to authenticated, service_role;

drop policy if exists "feedback categories visibility" on feedback_categories;
create policy "feedback categories visibility" on feedback_categories
  for select using (can_view_org_feedback_categories(organization_id, auth.uid()));
