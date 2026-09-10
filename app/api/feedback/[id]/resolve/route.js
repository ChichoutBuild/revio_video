import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../lib/getRequestUser';

export async function POST(request, { params }) {
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
      p_permission_code: 'FEEDBACK_RESOLVE',
    });
    allowed = data === true;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Permission refusée.' }, { status: 403 });
  }

  const feedbackId = params.id;

  // Défense en profondeur : même si service_role contourne RLS, on vérifie
  // explicitement que l'appelant a le droit de voir la vidéo concernée avant
  // de résoudre son feedback (au cas où FEEDBACK_RESOLVE serait un jour
  // accordé indépendamment de l'accès à une vidéo précise).
  let feedbackRow, feedbackError;
  try {
    ({ data: feedbackRow, error: feedbackError } = await supabaseAdmin
      .from('feedback')
      .select('id, video_version_id, status')
      .eq('id', feedbackId)
      .maybeSingle());
  } catch (e) {
    feedbackError = e;
  }
  if (feedbackError || !feedbackRow) {
    return NextResponse.json({ error: 'Retour introuvable.' }, { status: 404 });
  }

  let canView = false;
  try {
    const { data } = await supabaseAdmin.rpc('can_view_video_version', {
      p_video_version_id: feedbackRow.video_version_id,
      p_user_id: actor.id,
    });
    canView = data === true;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  if (!canView) {
    return NextResponse.json({ error: 'Permission refusée.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const resolutionNote = (body.resolutionNote || '').trim().slice(0, 2000) || null;

  let updateError;
  try {
    ({ error: updateError } = await supabaseAdmin
      .from('feedback')
      .update({
        status: 'RESOLVED',
        resolved_by: actor.id,
        resolved_at: new Date().toISOString(),
        resolution_note: resolutionNote,
      })
      .eq('id', feedbackId));
  } catch (e) {
    updateError = e;
  }
  if (updateError) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
