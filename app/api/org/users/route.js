import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashSecret, generateActivationCode } from '../../../../lib/authHash';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ⚠️ TEMPORAIRE : pas encore protégé par permission (arrivera au Sprint 3
// avec has_permission). Ne partage pas l'adresse /admin/users pour l'instant.
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

  if (!UUID_REGEX.test(organizationId)) {
    return NextResponse.json({ error: "ID d'organisation invalide." }, { status: 400 });
  }
  if (!displayName || displayName.length > 200) {
    return NextResponse.json({ error: 'Nom invalide (1 à 200 caractères).' }, { status: 400 });
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
  });
}
