-- Migration 013 — Déclenchement du push via pg_net directement, en
-- remplacement de l'interface "Database Webhooks" du dashboard (qui dépend
-- d'un schéma "supabase_functions" qui peut manquer sur certains projets).
--
-- pg_net est une extension standard de Supabase (utilisée en interne par de
-- nombreuses fonctionnalités de la plateforme) : plus fondamentale et plus
-- fiable que l'interface "Webhooks", et surtout, elle ne dépend d'aucune
-- configuration manuelle dans le dashboard — tout est dans cette migration.
--
-- ⚠️ AVANT D'EXÉCUTER CE SCRIPT : remplace les deux valeurs ci-dessous par
-- les tiennes :
--   1. 'https://TON-ADRESSE.vercel.app/api/webhooks/send-push'
--      → remplace par ta vraie adresse stable Vercel
--   2. 'TON_SUPABASE_WEBHOOK_SECRET'
--      → remplace par la même valeur que tu as mise dans la variable
--        d'environnement SUPABASE_WEBHOOK_SECRET sur Vercel

create extension if not exists pg_net;

create or replace function trigger_send_push_webhook() returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://TON-ADRESSE.vercel.app/api/webhooks/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'TON_SUPABASE_WEBHOOK_SECRET'
    ),
    body := jsonb_build_object('record', jsonb_build_object('id', new.id))
  );
  return new;
end;
$$;

drop trigger if exists trg_send_push_webhook on notification_deliveries;
create trigger trg_send_push_webhook
  after insert on notification_deliveries
  for each row execute function trigger_send_push_webhook();
