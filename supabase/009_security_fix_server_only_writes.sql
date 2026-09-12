-- Migration 009 — Correction de sécurité : gestion des groupes et de
-- l'accès vidéo retirée de RLS, déplacée vers des routes serveur dédiées.
--
-- Pourquoi : deux failles de sécurité précédentes (migration 006) venaient
-- de policies RLS mal maîtrisées. Plutôt que de continuer à ajouter des
-- fonctions SECURITY DEFINER de plus en plus complexes pour CES actions
-- précises (gestion des groupes, assignation de vérificateurs — peu
-- fréquentes, clairement "administratives"), on les fait passer par des
-- routes API serveur, vérifiées explicitement avec has_permission() AVANT
-- toute écriture, comme la résolution de feedback ou les transitions de
-- statut — le schéma qui s'est montré fiable jusqu'ici dans ce projet.
--
-- La LECTURE reste ouverte via RLS (can_view_org / can_view_group /
-- can_view_video) : voir qui a accès à une vidéo n'est pas sensible,
-- MODIFIER qui y a accès l'est.

drop policy if exists "user_groups insert" on user_groups;
drop policy if exists "user_groups delete" on user_groups;
drop policy if exists "user_group_members insert" on user_group_members;
drop policy if exists "user_group_members delete" on user_group_members;
drop policy if exists "video_access insert" on video_access;
drop policy if exists "video_access delete" on video_access;
