-- Migration 012 — Notifications push (Web Push, aucune plateforme tierce)
--
-- Principe : Web Push est un standard du navigateur (pas Firebase, pas
-- OneSignal). Chaque appareil génère un "abonnement" (endpoint + clés) que le
-- serveur utilise pour envoyer un message chiffré, adressé directement au
-- service du navigateur (Chrome, Firefox, Safari...) via le protocole Web
-- Push standard — aucun compte tiers à créer, aucune dépendance de
-- plateforme au-delà de ce qui existe déjà (Supabase + Vercel).

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on push_subscriptions(user_id) where is_active;

alter table push_subscriptions enable row level security;

create policy "push_subscriptions select own" on push_subscriptions
  for select using (user_id = auth.uid());
create policy "push_subscriptions insert own" on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "push_subscriptions delete own" on push_subscriptions
  for delete using (user_id = auth.uid());
-- Gérer son propre abonnement (s'inscrire/se désinscrire) est une action
-- personnelle, sans risque pour autrui — ouvert directement via RLS, comme
-- pour ses propres notifications.

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempt_count int not null default 0,
  last_attempted_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index on notification_deliveries(status) where status = 'PENDING';

alter table notification_deliveries enable row level security;
-- Aucune policy pour "authenticated" : uniquement lue/écrite par le serveur
-- (route webhook + service_role).

-- --- Répartition automatique : à chaque notification créée, une ligne de
-- --- livraison PENDING par appareil actif du destinataire.
create or replace function fanout_notification_deliveries() returns trigger
language plpgsql security definer
as $$
begin
  insert into notification_deliveries (notification_id, subscription_id)
  select new.id, ps.id
  from push_subscriptions ps
  where ps.user_id = new.recipient_id and ps.is_active;
  return new;
end;
$$;

drop trigger if exists trg_fanout_notification_deliveries on notifications;
create trigger trg_fanout_notification_deliveries
  after insert on notifications
  for each row execute function fanout_notification_deliveries();

-- Chaque insertion dans notification_deliveries déclenche, via un Database
-- Webhook Supabase (configuré depuis le Dashboard, voir le tutoriel),
-- un appel HTTP immédiat vers /api/webhooks/send-push qui envoie le vrai
-- push. Rien de plus à faire ici côté SQL.
