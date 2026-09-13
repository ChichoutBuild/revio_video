import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../lib/getRequestUser';

export async function PUT(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  let canView = false;
  let allowed = false;
  try {
    const [viewRes, permRes] = await Promise.all([
      supabaseAdmin.rpc('can_view_video', { p_video_id: params.id, p_user_id: actor.id }),
      supabaseAdmin.rpc('has_permission', { p_user_id: actor.id, p_permission_code: 'VIDEOS_EDIT' }),
    ]);
    canView = viewRes.data === true;
    allowed = permRes.data === true;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  if (!canView || !allowed) {
    return NextResponse.json({ error: 'Permission refusée.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const videoVersionId = (body.videoVersionId || '').trim();
  const description = (body.description || '').trim().slice(0, 5000);

  if (!videoVersionId) {
    return NextResponse.json({ error: 'Version manquante.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('video_versions')
    .update({ description: description || null })
    .eq('id', videoVersionId)
    .eq('video_id', params.id);
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
