import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashSecret, generateActivationCode } from '../../../../lib/authHash';
import { getRequestUser } from '../../../../lib/getRequestUser';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Règle : le tout premier utilisateur d'une organisation peut être créé sans
// être connecté (bootstrap — il n'y a encore personne pour l'autoriser), et
// reçoit automatiquement le rôle ADMIN. Tous les suivants exigent un appelant
// authentifié possédant la permission USERS_CREATE.
export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const organizationId = (body.organizationId || '').trim();
  const displayName = (body.displayName || '').trim();
  const requestedRole = body.role === 'ADMIN' ? 'ADMIN' : 'VERIFICATEUR';

  if (!UUID_REGEX.test(organizationId)) {
    return NextResponse.json({ error: "ID d'organisation invalide." }, { status: 400 });
  }
  if (!displayName || displayName.length > 200) {
    return NextResponse.json({ error: 'Nom invalide (1 à 200 caractères).' }, { status: 400 });
  }

  let existingCount = 0;
  try {
    const { count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    existingCount = count || 0;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  const isBootstrap = existingCount === 0;

  if (!isBootstrap) {
    const actor = await getRequestUser(request, supabaseAdmin);
    if (!actor) {
      return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
    }
    let allowed = false;
    try {
      const { data } = await supabaseAdmin.rpc('has_permission', {
        p_user_id: actor.id,
        p_permission_code: 'USERS_CREATE',
      });
      allowed = data === true;
    } catch (e) {
      return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Permission refusée.' }, { status: 403 });
    }
  }

  // Email synthétique interne, jamais réellement envoyé — domaine réservé
  // (RFC 2606) pour garantir qu'aucun tiers ne peut un jour le recevoir.
  const syntheticEmail = `user-${crypto.randomUUID()}@video-validation.invalid`;

  let createResult;
  try {
    createResult = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  const authUser = createResult?.data?.user;
  if (createResult?.error || !authUser) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  let userRow, userError;
  try {
    ({ data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        organization_id: organizationId,
        display_name: displayName,
        status: 'PENDING_ACTIVATION',
      })
      .select()
      .single());
  } catch (e) {
    userError = e;
  }

  if (userError || !userRow) {
    // Nettoyage : évite un compte Auth orphelin si l'insertion métier échoue
    // (par exemple si organizationId ne correspond à aucune organisation).
    try {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    } catch (_) {
      /* best effort */
    }
    return NextResponse.json({ error: "Impossible de créer l'utilisateur (organisation introuvable ?)." }, { status: 400 });
  }

  // Bootstrap : le tout premier utilisateur de l'organisation reçoit
  // TOUJOURS le rôle ADMIN (peu importe ce qui a été demandé — il n'y a
  // personne d'autre pour administrer l'organisation). Pour tous les
  // suivants, le rôle demandé (ADMIN ou VERIFICATEUR) est appliqué.
  try {
    const roleName = isBootstrap ? 'ADMIN' : requestedRole;
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', roleName)
      .maybeSingle();
    if (role) {
      await supabaseAdmin.from('user_roles').insert({ user_id: userRow.id, role_id: role.id });
    }
  } catch (e) {
    console.error("Erreur non bloquante lors de l'attribution du rôle :", e);
  }

  // Ajout automatique au groupe "Tout le monde" de l'organisation.
  try {
    const { data: autoGroup } = await supabaseAdmin
      .from('user_groups')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_auto', true)
      .maybeSingle();
    if (autoGroup) {
      await supabaseAdmin.from('user_group_members').insert({ group_id: autoGroup.id, user_id: userRow.id });
    }
  } catch (e) {
    console.error("Erreur non bloquante lors de l'ajout au groupe automatique :", e);
  }

  const plainCode = generateActivationCode();
  let codeHash;
  try {
    codeHash = hashSecret(plainCode);
  } catch (e) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  let codeError;
  try {
    ({ error: codeError } = await supabaseAdmin
      .from('activation_codes')
      .insert({ user_id: userRow.id, code_hash: codeHash, expires_at: expiresAt }));
  } catch (e) {
    codeError = e;
  }

  if (codeError) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  // Le code en clair n'est renvoyé qu'une seule fois, ici.
  return NextResponse.json({
    userId: userRow.id,
    displayName: userRow.display_name,
    activationCode: plainCode,
    expiresAt,
    wasBootstrapAdmin: isBootstrap,
    assignedRole: isBootstrap ? 'ADMIN' : requestedRole,
  });
}
