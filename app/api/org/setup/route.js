import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashSecret, generateRandomToken } from '../../../../lib/authHash';

const ALL_PERMISSION_CODES = [
  'VIDEOS_VIEW', 'VIDEOS_VIEW_ALL', 'VIDEOS_CREATE', 'VIDEOS_EDIT',
  'VIDEOS_DELETE', 'VIDEOS_ASSIGN', 'VIDEOS_CREATE_VERSION',
  'FEEDBACK_CREATE', 'FEEDBACK_REPLY', 'FEEDBACK_RESOLVE',
  'USERS_VIEW', 'USERS_CREATE', 'USERS_EDIT', 'USERS_DISABLE',
  'STATISTICS_VIEW', 'SETTINGS_MANAGE', 'ROLES_MANAGE', 'NOTIFICATIONS_MANAGE',
];
const VERIFICATEUR_PERMISSION_CODES = ['VIDEOS_VIEW', 'FEEDBACK_CREATE', 'FEEDBACK_REPLY'];

// ⚠️ Cet endpoint crée une toute nouvelle organisation : par nature, il ne
// peut pas être protégé par une vérification de permission (il n'existe
// encore aucun utilisateur pour cette organisation au moment de l'appel).
// Protection retenue à la place : un secret partagé, connu uniquement de toi
// (ADMIN_SETUP_SECRET), à fournir dans la requête.
export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  const expectedSecret = process.env.ADMIN_SETUP_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if ((body.setupSecret || '') !== expectedSecret) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const organizationName = (body.organizationName || '').trim();
  if (!organizationName || organizationName.length > 200) {
    return NextResponse.json({ error: "Nom d'organisation invalide (1 à 200 caractères)." }, { status: 400 });
  }

  let org, orgError;
  try {
    ({ data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: organizationName })
      .select()
      .single());
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  if (orgError) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  let plainToken;
  try {
    plainToken = generateRandomToken('TEAM');
  } catch (e) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  let tokenHash;
  try {
    tokenHash = hashSecret(plainToken);
  } catch (e) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  let tokenError;
  try {
    ({ error: tokenError } = await supabaseAdmin
      .from('association_tokens')
      .insert({ organization_id: org.id, token_hash: tokenHash }));
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  if (tokenError) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  // Crée les deux rôles par défaut de l'organisation (ADMIN avec toutes les
  // permissions, VERIFICATEUR avec un sous-ensemble). Erreurs ici non
  // bloquantes pour la réponse (l'organisation existe déjà) mais journalisées
  // côté serveur — best effort, une vraie gestion d'erreur transactionnelle
  // viendra plus tard si besoin.
  try {
    const { data: allPerms } = await supabaseAdmin.from('permissions').select('id, code');
    const permByCode = Object.fromEntries((allPerms || []).map((p) => [p.code, p.id]));

    const { data: adminRole } = await supabaseAdmin
      .from('roles')
      .insert({ organization_id: org.id, name: 'ADMIN', is_system: true })
      .select()
      .single();
    const { data: verifRole } = await supabaseAdmin
      .from('roles')
      .insert({ organization_id: org.id, name: 'VERIFICATEUR', is_system: true })
      .select()
      .single();

    if (adminRole) {
      const rows = ALL_PERMISSION_CODES.filter((c) => permByCode[c]).map((c) => ({
        role_id: adminRole.id,
        permission_id: permByCode[c],
      }));
      if (rows.length) await supabaseAdmin.from('role_permissions').insert(rows);
    }
    if (verifRole) {
      const rows = VERIFICATEUR_PERMISSION_CODES.filter((c) => permByCode[c]).map((c) => ({
        role_id: verifRole.id,
        permission_id: permByCode[c],
      }));
      if (rows.length) await supabaseAdmin.from('role_permissions').insert(rows);
    }
  } catch (e) {
    console.error('Erreur non bloquante lors de la création des rôles par défaut :', e);
  }

  // Le token en clair n'est renvoyé qu'une seule fois, ici — jamais stocké
  // ailleurs qu'en version hashée en base.
  return NextResponse.json({
    organizationId: org.id,
    organizationName: org.name,
    token: plainToken,
  });
}
