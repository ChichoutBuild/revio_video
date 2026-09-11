import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../../lib/getRequestUser';

const VALID_STATUSES = [
  'BROUILLON', 'A_VERIFIER', 'EN_VERIFICATION',
  'MODIFICATIONS_DEMANDEES', 'APPROUVEE', 'PUBLIEE', 'ARCHIVEE',
];

export async function POST(request, { params }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const newStatus = (body.newStatus || '').trim();
  if (!VALID_STATUSES.includes(newStatus)) {
    return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
  }

  let videoRow;
  try {
    const { data } = await supabaseAdmin
      .from('videos')
      .select('current_version_id')
      .eq('id', params.id)
      .maybeSingle();
    videoRow = data;
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }
  if (!videoRow?.current_version_id) {
    return NextResponse.json({ error: 'Vidéo introuvable.' }, { status: 404 });
  }

  let rpcResult;
  try {
    rpcResult = await supabaseAdmin.rpc('transition_video_version_status', {
      p_video_version_id: videoRow.current_version_id,
      p_new_status: newStatus,
      p_actor_id: actor.id,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  const message = rpcResult?.error?.message || '';
  if (message.includes('PERMISSION_DENIED')) {
    return NextResponse.json({ error: 'Permission refusée.' }, { status: 403 });
  }
  if (message.includes('INVALID_TRANSITION')) {
    return NextResponse.json({ error: 'Cette transition de statut n\'est pas autorisée depuis le statut actuel.' }, { status: 409 });
  }
  if (message.includes('VERSION_NOT_FOUND')) {
    return NextResponse.json({ error: 'Version introuvable.' }, { status: 404 });
  }
  if (rpcResult?.error) {
    return NextResponse.json({ error: 'Service momentanément indisponible, réessaie plus tard.' }, { status: 503 });
  }

  return NextResponse.json({ status: rpcResult?.data?.status });
}
