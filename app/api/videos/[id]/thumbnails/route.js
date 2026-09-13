import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../lib/getRequestUser';

const VALID_LABELS = ['A', 'B', 'C'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function checkView(request, videoId) {
  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) return { error: NextResponse.json({ error: 'Connexion requise.' }, { status: 401 }) };
  let canView = false;
  try {
    const { data } = await supabaseAdmin.rpc('can_view_video', { p_video_id: videoId, p_user_id: actor.id });
    canView = data === true;
  } catch (e) {
    return { error: NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 }) };
  }
  if (!canView) return { error: NextResponse.json({ error: 'Permission refusée.' }, { status: 403 }) };
  return { actor };
}

async function checkEdit(request, videoId) {
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
  if (!canView || !allowed) return { error: NextResponse.json({ error: 'Permission refusée.' }, { status: 403 }) };
  return { actor };
}

// GET : liste les miniatures d'une version avec une URL signée temporaire
// pour chacune (le bucket est privé — jamais d'URL publique permanente).
export async function GET(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const videoVersionId = searchParams.get('videoVersionId');
  if (!videoVersionId) {
    return NextResponse.json({ error: 'Version manquante.' }, { status: 400 });
  }

  const check = await checkView(request, params.id);
  if (check.error) return check.error;

  const { data: options, error } = await supabaseAdmin
    .from('video_thumbnail_options')
    .select('id, label, storage_path')
    .eq('video_version_id', videoVersionId);
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  const withUrls = await Promise.all(
    (options || []).map(async (opt) => {
      const { data: signed } = await supabaseAdmin.storage.from('thumbnails').createSignedUrl(opt.storage_path, 3600);
      return { id: opt.id, label: opt.label, url: signed?.signedUrl || null };
    })
  );

  return NextResponse.json({ thumbnails: withUrls });
}

export async function POST(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  const check = await checkEdit(request, params.id);
  if (check.error) return check.error;

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const videoVersionId = (formData.get('videoVersionId') || '').toString().trim();
  const label = (formData.get('label') || '').toString().trim().toUpperCase();
  const file = formData.get('file');

  if (!videoVersionId) {
    return NextResponse.json({ error: 'Version manquante.' }, { status: 400 });
  }
  if (!VALID_LABELS.includes(label)) {
    return NextResponse.json({ error: 'Étiquette invalide (A, B ou C).' }, { status: 400 });
  }
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (jpg, png ou webp uniquement).' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (2 Mo maximum).' }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from('video_thumbnail_options')
    .select('*', { count: 'exact', head: true })
    .eq('video_version_id', videoVersionId);
  if ((count || 0) >= 3) {
    return NextResponse.json({ error: 'Maximum 3 miniatures déjà atteint.' }, { status: 409 });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${videoVersionId}/${label}-${Date.now()}.${ext}`;

  let buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (e) {
    return NextResponse.json({ error: 'Fichier illisible.' }, { status: 400 });
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from('thumbnails')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: "Échec de l'upload, réessaie plus tard." }, { status: 503 });
  }

  const { error: dbError } = await supabaseAdmin
    .from('video_thumbnail_options')
    .insert({ video_version_id: videoVersionId, label, storage_path: storagePath });
  if (dbError) {
    // Nettoyage : évite un fichier orphelin dans le stockage si l'insertion échoue.
    try {
      await supabaseAdmin.storage.from('thumbnails').remove([storagePath]);
    } catch (_) {
      /* best effort */
    }
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  const check = await checkEdit(request, params.id);
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

  const { data: option } = await supabaseAdmin
    .from('video_thumbnail_options')
    .select('storage_path')
    .eq('id', optionId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from('video_thumbnail_options').delete().eq('id', optionId);
  if (error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  if (option?.storage_path) {
    try {
      await supabaseAdmin.storage.from('thumbnails').remove([option.storage_path]);
    } catch (e) {
      console.error('Erreur non bloquante (suppression fichier) :', e);
    }
  }

  return NextResponse.json({ ok: true });
}
