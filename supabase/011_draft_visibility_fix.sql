-- Migration 011 — Correction : une vidéo en BROUILLON ne doit être visible
-- que par son créateur ou un administrateur, jamais par un vérificateur via
-- l'accès normal (ALL_TEAM/GROUP/ROLE/USER) — ces accès ne s'appliquent
-- qu'à partir du moment où la vidéo est envoyée en vérification.

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
    or (
      -- L'accès normal (toute l'équipe / groupe / rôle / utilisateur précis)
      -- ne s'applique QUE si la vidéo n'est plus en BROUILLON.
      exists (
        select 1 from videos v
        join video_versions vv on vv.id = v.current_version_id
        where v.id = p_video_id and vv.status <> 'BROUILLON'
      )
      and exists (
        select 1 from video_access va
        where va.video_id = p_video_id and (
          va.scope_type = 'ALL_TEAM'
          or (va.scope_type = 'ROLE' and va.role_id in (select role_id from user_roles where user_id = p_user_id))
          or (va.scope_type = 'USER' and va.user_id = p_user_id)
          or (va.scope_type = 'GROUP' and va.group_id in (select group_id from user_group_members where user_id = p_user_id))
        )
      )
    )
  );
$$;
-- "create or replace" : toutes les policies qui utilisent déjà cette
-- fonction (vidéos, versions, sources, feedback...) héritent automatiquement
-- de la correction.
