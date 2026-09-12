import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../lib/getRequestUser';

async function checkAccess(request, videoId) {
  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) return { error: NextResponse.json({ error: 'Connexion requise.' }, { status: 401 }) };

  let canView = false;
  let allowed = false;
  try {
    const [viewRes, permRes] = await Promise.all([
      supabaseAdmin.rpc('can_view_video', { p_video_id: videoId, p_user_id: actor.id }),
      supabaseAdmin.rpc('has_permission', { p_user_id: actor.id, p_permission_code: 'VIDEOS_ASSIGN' }),
    ]);
    canView = viewRes.data === true;
    allowed = permRes.data === true;
  } catch (e) {
    return { error: NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 }) };
  }
  if (!canView || !allowed) {
    return { error: NextResponse.json({ error: 'Permission refusée.' }, { status: 403 }) };
  }
  return { actor };
}

export async function POST(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  const check = await checkAccess(request, params.id);
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const groupId = (body.groupId || '').trim();
  if (!groupId) {
    return NextResponse.json({ error: 'Groupe manquant.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('video_access')
    .insert({ video_id: params.id, scope_type: 'GROUP', group_id: groupId });
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  const check = await checkAccess(request, params.id);
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const accessId = (body.accessId || '').trim();
  if (!accessId) {
    return NextResponse.json({ error: "Accès manquant." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('video_access').delete().eq('id', accessId).eq('video_id', params.id);
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
