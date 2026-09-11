-- Migration 007 — Transitions de statut vidéo + journal d'activité

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references users(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on activity_logs(organization_id, entity_type, entity_id, created_at desc);
alter table activity_logs enable row level security;
-- Pas de policy pour "authenticated" : lecture réservée au serveur pour
-- l'instant (une page "historique" dédiée viendra dans une étape ultérieure).

-- Table de vérité des transitions autorisées (section F.1 de l'architecture v2.1).
create or replace function can_transition(p_from text, p_to text)
returns boolean
language sql immutable
as $$
  select (p_from, p_to) in (
    ('BROUILLON', 'A_VERIFIER'),
    ('A_VERIFIER', 'EN_VERIFICATION'),
    ('EN_VERIFICATION', 'MODIFICATIONS_DEMANDEES'),
    ('MODIFICATIONS_DEMANDEES', 'EN_VERIFICATION'),
    ('EN_VERIFICATION', 'APPROUVEE'),
    ('APPROUVEE', 'PUBLIEE'),
    ('PUBLIEE', 'ARCHIVEE')
  );
$$;

-- Toute la logique de transition dans une seule fonction serveur, verrouillée
-- (FOR UPDATE) pour éviter deux transitions concurrentes contradictoires,
-- avec vérification de permission ET de visibilité de la vidéo.
create or replace function transition_video_version_status(
  p_video_version_id uuid,
  p_new_status text,
  p_actor_id uuid
)
returns video_versions
language plpgsql
security definer
as $$
declare
  v_current text;
  v_video_id uuid;
  v_org_id uuid;
  v_row video_versions;
begin
  select status, video_id into v_current, v_video_id
  from video_versions where id = p_video_version_id
  for update;

  if v_current is null then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  if not can_view_video(v_video_id, p_actor_id) or not has_permission(p_actor_id, 'VIDEOS_EDIT') then
    raise exception 'PERMISSION_DENIED';
  end if;

  if not can_transition(v_current, p_new_status) then
    raise exception 'INVALID_TRANSITION';
  end if;

  update video_versions set status = p_new_status
  where id = p_video_version_id
  returning * into v_row;

  select organization_id into v_org_id from videos where id = v_video_id;

  insert into activity_logs (organization_id, actor_id, entity_type, entity_id, action, metadata)
  values (v_org_id, p_actor_id, 'video_version', p_video_version_id, 'status_changed',
          jsonb_build_object('from', v_current, 'to', p_new_status));

  return v_row;
end;
$$;

grant execute on function transition_video_version_status(uuid, text, uuid) to service_role;
