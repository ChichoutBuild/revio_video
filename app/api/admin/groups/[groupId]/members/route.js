import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../../lib/getRequestUser';

async function checkAccess(request, groupId) {
  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) return { error: NextResponse.json({ error: 'Connexion requise.' }, { status: 401 }) };

  let allowed = false;
  try {
    const { data } = await supabaseAdmin.rpc('has_permission', {
      p_user_id: actor.id,
      p_permission_code: 'ROLES_MANAGE',
    });
    allowed = data === true;
  } catch (e) {
    return { error: NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 }) };
  }
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Permission refusée.' }, { status: 403 }) };
  }

  let group;
  try {
    const { data } = await supabaseAdmin.from('user_groups').select('id, organization_id, is_auto').eq('id', groupId).maybeSingle();
    group = data;
  } catch (e) {
    return { error: NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 }) };
  }
  if (!group) {
    return { error: NextResponse.json({ error: 'Groupe introuvable.' }, { status: 404 }) };
  }
  if (group.is_auto) {
    return { error: NextResponse.json({ error: 'Le groupe "Tout le monde" est automatique, non modifiable.' }, { status: 409 }) };
  }

  let sameOrg = false;
  try {
    const { data } = await supabaseAdmin.from('users').select('organization_id').eq('id', actor.id).single();
    sameOrg = data?.organization_id === group.organization_id;
  } catch (e) {
    return { error: NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 }) };
  }
  if (!sameOrg) {
    return { error: NextResponse.json({ error: 'Permission refusée.' }, { status: 403 }) };
  }

  return { actor, group };
}

export async function POST(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  const check = await checkAccess(request, params.groupId);
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const userId = (body.userId || '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'Utilisateur manquant.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('user_group_members').insert({ group_id: params.groupId, user_id: userId });
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  const check = await checkAccess(request, params.groupId);
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const userId = (body.userId || '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'Utilisateur manquant.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('user_group_members')
    .delete()
    .eq('group_id', params.groupId)
    .eq('user_id', userId);
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
