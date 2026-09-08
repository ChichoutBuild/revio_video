import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { hashSecret } from '../../../../lib/authHash';

// TODO (prochaine étape) : rate limiting par IP, cf. architecture v2.1 section 5.3/6.
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

  const code = (body.code || '').trim().toUpperCase();
  if (!code || code.length > 50) {
    return NextResponse.json({ error: 'Code manquant ou invalide.' }, { status: 400 });
  }

  let codeHash;
  try {
    codeHash = hashSecret(code);
  } catch (e) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  let codeRow, codeError;
  try {
    ({ data: codeRow, error: codeError } = await supabaseAdmin
      .from('activation_codes')
      .select('id, user_id, expires_at, used_at, locked_at')
      .eq('code_hash', codeHash)
      .maybeSingle());
  } catch (e) {
    codeError = e;
  }

  if (codeError) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  if (!codeRow) {
    return NextResponse.json({ error: 'Ce code est invalide.' }, { status: 404 });
  }
  if (codeRow.used_at) {
    return NextResponse.json({ error: 'Ce code a déjà été utilisé.' }, { status: 409 });
  }
  if (codeRow.locked_at) {
    return NextResponse.json({ error: 'Ce code a été verrouillé, demande un nouveau code à ton administrateur.' }, { status: 423 });
  }
  if (new Date(codeRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Ce code a expiré, demande un nouveau code à ton administrateur.' }, { status: 410 });
  }

  let authUserResp;
  try {
    authUserResp = await supabaseAdmin.auth.admin.getUserById(codeRow.user_id);
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  const email = authUserResp?.data?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }

  let linkResult;
  try {
    linkResult = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  const hashedToken = linkResult?.data?.properties?.hashed_token;
  if (linkResult?.error || !hashedToken) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  // On ne marque le code comme utilisé et le compte comme actif qu'APRÈS
  // avoir réussi à générer le lien — pour ne jamais "consommer" un code
  // à usage unique si cette dernière étape venait à échouer.
  try {
    await supabaseAdmin.from('activation_codes').update({ used_at: new Date().toISOString() }).eq('id', codeRow.id);
    await supabaseAdmin.from('users').update({ status: 'ACTIVE' }).eq('id', codeRow.user_id);
  } catch (e) {
    // Le lien a déjà été généré à ce stade ; on laisse l'utilisateur continuer
    // plutôt que de le bloquer sur une erreur de mise à jour secondaire.
  }

  return NextResponse.json({ hashedToken });
}
