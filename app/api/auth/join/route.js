import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashSecret } from '../../../../lib/authHash';

// TODO (prochaine étape) : rate limiting par IP, cf. architecture v2.1 section 5.3.
// Volontairement pas encore implémenté ici pour garder cette étape petite et
// testable — à ajouter avant toute exposition publique réelle.
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

  const token = (body.token || '').trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'Token manquant ou invalide.' }, { status: 400 });
  }

  let tokenHash;
  try {
    tokenHash = hashSecret(token);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let data, error;
  try {
    ({ data, error } = await supabaseAdmin
      .from('association_tokens')
      .select('organization_id, is_active, organizations ( name )')
      .eq('token_hash', tokenHash)
      .maybeSingle());
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  if (!data || !data.is_active) {
    return NextResponse.json({ error: "Ce code n'est pas reconnu ou a été révoqué." }, { status: 404 });
  }

  return NextResponse.json({ organizationName: data.organizations?.name ?? null });
}
