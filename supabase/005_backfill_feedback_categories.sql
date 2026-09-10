-- Migration 005 — Rattrapage : catégories de retours par défaut pour les
-- organisations créées AVANT l'ajout de cette fonctionnalité (migration 004).
-- Sûr à exécuter plusieurs fois : "on conflict do nothing" évite les doublons
-- grâce à la contrainte unique (organization_id, name).

insert into feedback_categories (organization_id, name, color, icon, sort_order, is_blocking)
select o.id, c.name, c.color, c.icon, c.sort_order, c.is_blocking
from organizations o
cross join (
  values
    ('Conseil', '#3B82F6', '💡', 1, false),
    ('Modification', '#F59E0B', '🟡', 2, false),
    ('Bloquant', '#EF4444', '🔴', 3, true),
    ('Point fort', '#10B981', '🟢', 4, false)
) as c(name, color, icon, sort_order, is_blocking)
on conflict (organization_id, name) do nothing;
