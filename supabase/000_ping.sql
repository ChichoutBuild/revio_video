-- Migration 000 — Vérification de connexion uniquement.
-- Ne crée AUCUNE table métier volontairement : ce script sert seulement à
-- prouver que l'application Next.js déployée arrive bien à interroger la
-- base Supabase, avant de construire le vrai schéma (organisations,
-- utilisateurs, etc.) dans les prochaines étapes.

create or replace function public.ping()
returns text
language sql
security definer
as $$
  select 'pong'::text;
$$;

-- Autorise l'appel de cette fonction avec la clé "anon" (celle utilisée
-- côté navigateur) et avec un utilisateur connecté ("authenticated").
grant execute on function public.ping() to anon, authenticated;
