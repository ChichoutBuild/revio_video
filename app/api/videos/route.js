import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../lib/getRequestUser';
import { parseYoutubeVideoId } from '../../../lib/youtube';

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
      p_permission_code: 'VIDEOS_CREATE',
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
  const category = body.category === 'SHORT' ? 'SHORT' : 'LONG';
  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'Nom invalide (1 à 200 caractères).' }, { status: 400 });
  }

  const youtubeId = parseYoutubeVideoId(body.youtubeInput || '');
  if (!youtubeId) {
    return NextResponse.json(
      { error: "Lien ou ID YouTube invalide. Colle l'URL complète de la vidéo non répertoriée, ou juste son ID." },
      { status: 400 }
    );
  }

  // L'organisation n'est jamais fournie par le client : elle est déduite du
  // profil de l'appelant, pour ne jamais faire confiance à une valeur envoyée
  // depuis le navigateur pour une donnée de cette sensibilité.
  let profile, profileError;
  try {
    ({ data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', actor.id)
      .single());
  } catch (e) {
    profileError = e;
  }
  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 400 });
  }

  let video, videoError;
  try {
    ({ data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .insert({ organization_id: profile.organization_id, name, category, created_by: actor.id })
      .select()
      .single());
  } catch (e) {
    videoError = e;
  }
  if (videoError || !video) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  let version, versionError;
  try {
    ({ data: version, error: versionError } = await supabaseAdmin
      .from('video_versions')
      .insert({ video_id: video.id, version_number: 1, status: 'BROUILLON', created_by: actor.id })
      .select()
      .single());
  } catch (e) {
    versionError = e;
  }
  if (versionError || !version) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  try {
    await supabaseAdmin.from('videos').update({ current_version_id: version.id }).eq('id', video.id);
  } catch (e) {
    console.error('Erreur non bloquante (current_version_id) :', e);
  }

  let sourceError;
  try {
    ({ error: sourceError } = await supabaseAdmin
      .from('video_sources')
      .insert({ video_version_id: version.id, type: 'YOUTUBE', external_id: youtubeId }));
  } catch (e) {
    sourceError = e;
  }
  if (sourceError) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  // Accès par défaut : toute l'équipe. L'assignation fine (rôle/utilisateur/
  // groupe précis) viendra dans une étape ultérieure dédiée.
  try {
    await supabaseAdmin.from('video_access').insert({ video_id: video.id, scope_type: 'ALL_TEAM' });
  } catch (e) {
    console.error("Erreur non bloquante (accès par défaut) :", e);
  }

  try {
    await supabaseAdmin.from('activity_logs').insert({
      organization_id: profile.organization_id,
      actor_id: actor.id,
      entity_type: 'video',
      entity_id: video.id,
      action: 'created',
      metadata: { name: video.name },
    });
  } catch (e) {
    console.error('Erreur non bloquante (activity_logs) :', e);
  }

  return NextResponse.json({ videoId: video.id, name: video.name, versionId: version.id });
}
