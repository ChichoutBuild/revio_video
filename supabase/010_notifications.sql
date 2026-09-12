-- Migration 010 — Centre de notifications interne (in-app uniquement, pas de
-- push natif dans cette étape — voir note en fin de fichier).

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  dedup_key text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedup_key)
);
create index on notifications(recipient_id, is_read, created_at desc);

alter table notifications enable row level security;

create policy "notifications select own" on notifications
  for select using (recipient_id = auth.uid());

create policy "notifications update own" on notifications
  for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
-- Pas de policy insert/delete pour "authenticated" : uniquement créées par
-- les triggers/fonctions serveur ci-dessous (SECURITY DEFINER).

-- --- Fonction utilitaire : création idempotente -----------------------------
create or replace function create_notification(
  p_organization_id uuid, p_recipient_id uuid, p_type text, p_payload jsonb, p_dedup_key text
) returns void
language plpgsql security definer
as $$
begin
  insert into notifications (organization_id, recipient_id, type, payload, dedup_key)
  values (p_organization_id, p_recipient_id, p_type, p_payload, p_dedup_key)
  on conflict (recipient_id, dedup_key) do nothing;
end;
$$;

-- --- Résolution des destinataires (qui a accès à une vidéo) -----------------
-- Même logique que can_view_video, mais énumère les utilisateurs plutôt que
-- de vérifier une seule personne. Volontairement calculée côté serveur
-- uniquement — jamais une liste de destinataires envoyée par le client.
create or replace function resolve_video_viewers(p_video_id uuid)
returns setof uuid
language sql stable security definer
as $$
  select distinct u.id
  from users u
  where u.status = 'ACTIVE'
    and u.organization_id = (select organization_id from videos where id = p_video_id)
    and (
      u.id = (select created_by from videos where id = p_video_id)
      or exists (
        select 1 from video_access va
        where va.video_id = p_video_id and (
          va.scope_type = 'ALL_TEAM'
          or (va.scope_type = 'ROLE' and va.role_id in (select role_id from user_roles where user_id = u.id))
          or (va.scope_type = 'USER' and va.user_id = u.id)
          or (va.scope_type = 'GROUP' and va.group_id in (select group_id from user_group_members where user_id = u.id))
        )
      )
    );
$$;

-- --- Trigger : nouveau feedback → notifie le créateur de la vidéo -----------
create or replace function notify_on_feedback_created() returns trigger
language plpgsql security definer
as $$
declare
  v_org_id uuid;
  v_creator_id uuid;
  v_video_id uuid;
begin
  select v.organization_id, v.created_by, v.id into v_org_id, v_creator_id, v_video_id
  from videos v
  join video_versions vv on vv.video_id = v.id
  where vv.id = new.video_version_id;

  if v_creator_id is not null and v_creator_id <> new.author_id then
    perform create_notification(
      v_org_id, v_creator_id, 'FEEDBACK_CREATED',
      jsonb_build_object('video_id', v_video_id, 'video_version_id', new.video_version_id, 'feedback_id', new.id),
      'FEEDBACK_CREATED:' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_feedback_created on feedback;
create trigger trg_notify_feedback_created
  after insert on feedback
  for each row execute function notify_on_feedback_created();

-- --- Trigger : feedback résolu → notifie l'auteur du retour -----------------
create or replace function notify_on_feedback_resolved() returns trigger
language plpgsql security definer
as $$
declare
  v_org_id uuid;
begin
  if new.status = 'RESOLVED' and old.status is distinct from 'RESOLVED' and new.resolved_by <> new.author_id then
    select v.organization_id into v_org_id
    from videos v
    join video_versions vv on vv.video_id = v.id
    where vv.id = new.video_version_id;

    perform create_notification(
      v_org_id, new.author_id, 'FEEDBACK_RESOLVED',
      jsonb_build_object('video_version_id', new.video_version_id, 'feedback_id', new.id),
      'FEEDBACK_RESOLVED:' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_feedback_resolved on feedback;
create trigger trg_notify_feedback_resolved
  after update on feedback
  for each row execute function notify_on_feedback_resolved();

-- --- Trigger : réponse à un feedback → notifie l'auteur + les répondants ---
create or replace function notify_on_feedback_reply() returns trigger
language plpgsql security definer
as $$
declare
  v_org_id uuid;
  v_recipient uuid;
begin
  select v.organization_id into v_org_id
  from videos v
  join video_versions vv on vv.video_id = v.id
  join feedback f on f.video_version_id = vv.id
  where f.id = new.feedback_id;

  for v_recipient in
    select distinct participant_id from (
      select author_id as participant_id from feedback where id = new.feedback_id
      union
      select author_id as participant_id from feedback_replies where feedback_id = new.feedback_id
    ) p
    where participant_id <> new.author_id
  loop
    perform create_notification(
      v_org_id, v_recipient, 'FEEDBACK_REPLY_CREATED',
      jsonb_build_object('feedback_id', new.feedback_id, 'reply_id', new.id),
      'FEEDBACK_REPLY_CREATED:' || new.id::text || ':' || v_recipient::text
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_feedback_reply on feedback_replies;
create trigger trg_notify_feedback_reply
  after insert on feedback_replies
  for each row execute function notify_on_feedback_reply();

-- --- Transition de statut : notifie tous les vérificateurs à "À vérifier" --
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
  v_recipient uuid;
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

  if p_new_status = 'A_VERIFIER' then
    for v_recipient in select * from resolve_video_viewers(v_video_id) loop
      if v_recipient <> p_actor_id then
        perform create_notification(
          v_org_id, v_recipient, 'VIDEO_READY_FOR_REVIEW',
          jsonb_build_object('video_id', v_video_id, 'video_version_id', p_video_version_id),
          'VIDEO_READY_FOR_REVIEW:' || p_video_version_id::text || ':' || v_recipient::text
        );
      end if;
    end loop;
  end if;

  return v_row;
end;
$$;

-- NOTE (limitation volontaire de cette étape) : ceci est un centre de
-- notifications interne uniquement (visible dans l'app). L'envoi push
-- (Web Push / FCM) nécessite sa propre configuration (clés VAPID, service
-- worker adapté) et sera une étape séparée si tu la veux — l'architecture
-- (table "notifications" distincte des futures "notification_deliveries")
-- est prévue pour ça sans tout reconstruire.
