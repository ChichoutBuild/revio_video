import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../lib/getRequestUser';

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  let allowed = false;
  try {
    const { data } = await supabaseAdmin.rpc('has_permission', {
      p_user_id: actor.id,
      p_permission_code: 'ROLES_MANAGE',
    });
    allowed = data === true;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Permission refusée.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const name = (body.name || '').trim();
  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'Nom invalide (1 à 200 caractères).' }, { status: 400 });
  }

  let profile;
  try {
    const { data } = await supabaseAdmin.from('users').select('organization_id').eq('id', actor.id).single();
    profile = data;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 400 });
  }

  let group, groupError;
  try {
    ({ data: group, error: groupError } = await supabaseAdmin
      .from('user_groups')
      .insert({ organization_id: profile.organization_id, name, is_auto: false })
      .select()
      .single());
  } catch (e) {
    groupError = e;
  }
  if (groupError || !group) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  return NextResponse.json({ id: group.id, name: group.name });
}
