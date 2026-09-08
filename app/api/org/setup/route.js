import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashSecret, generateRandomToken } from '../../../../lib/authHash';

// ⚠️ TEMPORAIRE : cet endpoint n'est protégé par AUCUNE vérification de
// permission — il ne devrait normalement être accessible qu'à un admin déjà
// authentifié, mais le système de permissions n'existe pas encore (Sprint 3).
// À verrouiller avant tout usage réel avec plusieurs personnes. Pour l'instant,
// ne partage l'adresse /admin/setup avec personne.
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

  // Le token en clair n'est renvoyé qu'une seule fois, ici — jamais stocké
  // ailleurs qu'en version hashée en base.
  return NextResponse.json({
    organizationId: org.id,
    organizationName: org.name,
    token: plainToken,
  });
}
