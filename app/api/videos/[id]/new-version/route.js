import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../lib/getRequestUser';
import { parseYoutubeVideoId } from '../../../../../lib/youtube';

export async function POST(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  const videoId = params.id;

  let canView = false;
  let allowed = false;
  try {
    const [viewRes, permRes] = await Promise.all([
      supabaseAdmin.rpc('can_view_video', { p_video_id: videoId, p_user_id: actor.id }),
      supabaseAdmin.rpc('has_permission', { p_user_id: actor.id, p_permission_code: 'VIDEOS_CREATE_VERSION' }),
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
  const youtubeId = parseYoutubeVideoId(body.youtubeInput || '');
  if (!youtubeId) {
    return NextResponse.json(
      { error: "Lien ou ID YouTube invalide. La nouvelle version a besoin de sa propre source vidéo." },
      { status: 400 }
    );
  }

  let maxVersion;
  try {
    const { data } = await supabaseAdmin
      .from('video_versions')
      .select('version_number')
      .eq('video_id', videoId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    maxVersion = data?.version_number || 0;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  let newVersion, versionError;
  try {
    ({ data: newVersion, error: versionError } = await supabaseAdmin
      .from('video_versions')
      .insert({ video_id: videoId, version_number: maxVersion + 1, status: 'BROUILLON', created_by: actor.id })
      .select()
      .single());
  } catch (e) {
    versionError = e;
  }
  if (versionError || !newVersion) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  let sourceError;
  try {
    ({ error: sourceError } = await supabaseAdmin
      .from('video_sources')
      .insert({ video_version_id: newVersion.id, type: 'YOUTUBE', external_id: youtubeId }));
  } catch (e) {
    sourceError = e;
  }
  if (sourceError) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  try {
    await supabaseAdmin.from('videos').update({ current_version_id: newVersion.id }).eq('id', videoId);
  } catch (e) {
    console.error('Erreur non bloquante (current_version_id) :', e);
  }

  try {
    const { data: video } = await supabaseAdmin.from('videos').select('organization_id').eq('id', videoId).single();
    if (video) {
      await supabaseAdmin.from('activity_logs').insert({
        organization_id: video.organization_id,
        actor_id: actor.id,
        entity_type: 'video_version',
        entity_id: newVersion.id,
        action: 'version_created',
        metadata: { version_number: newVersion.version_number },
      });
    }
  } catch (e) {
    console.error('Erreur non bloquante (activity_logs) :', e);
  }

  return NextResponse.json({ versionId: newVersion.id, versionNumber: newVersion.version_number });
}
