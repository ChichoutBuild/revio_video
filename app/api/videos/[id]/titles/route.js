import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../lib/getRequestUser';

const VALID_LABELS = ['A', 'B', 'C'];

async function checkAccess(request, videoId) {
  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) return { error: NextResponse.json({ error: 'Connexion requise.' }, { status: 401 }) };

  let canView = false;
  let allowed = false;
  try {
    const [viewRes, permRes] = await Promise.all([
      supabaseAdmin.rpc('can_view_video', { p_video_id: videoId, p_user_id: actor.id }),
      supabaseAdmin.rpc('has_permission', { p_user_id: actor.id, p_permission_code: 'VIDEOS_EDIT' }),
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
  const videoVersionId = (body.videoVersionId || '').trim();
  const label = (body.label || '').trim().toUpperCase();
  const title = (body.title || '').trim();

  if (!videoVersionId) {
    return NextResponse.json({ error: 'Version manquante.' }, { status: 400 });
  }
  if (!VALID_LABELS.includes(label)) {
    return NextResponse.json({ error: 'Étiquette invalide (A, B ou C).' }, { status: 400 });
  }
  if (!title || title.length > 200) {
    return NextResponse.json({ error: 'Titre invalide (1 à 200 caractères).' }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from('video_title_options')
    .select('*', { count: 'exact', head: true })
    .eq('video_version_id', videoVersionId);
  if ((count || 0) >= 3) {
    return NextResponse.json({ error: 'Maximum 3 titres déjà atteint.' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('video_title_options')
    .insert({ video_version_id: videoVersionId, label, title });
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
  const optionId = (body.optionId || '').trim();
  if (!optionId) {
    return NextResponse.json({ error: 'Option manquante.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('video_title_options').delete().eq('id', optionId);
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
