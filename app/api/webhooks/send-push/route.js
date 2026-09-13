import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const TYPE_LABELS = {
  FEEDBACK_CREATED: 'Nouveau retour',
  FEEDBACK_RESOLVED: 'Retour résolu',
  FEEDBACK_REPLY_CREATED: 'Réponse à un retour',
  VIDEO_READY_FOR_REVIEW: 'Vidéo à vérifier',
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails('mailto:admin@example.com', publicKey, privateKey);
    return true;
  } catch (e) {
    console.error('Clés VAPID invalides :', e.message);
    return false;
  }
}

export async function POST(request) {
  // Vérifie que l'appel vient bien de notre configuration Supabase (en-tête
  // secret ajouté manuellement lors de la création du Database Webhook),
  // jamais d'une requête arbitraire.
  const secret = request.headers.get('x-webhook-secret');
  if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }
  if (!configureWebPush()) {
    return NextResponse.json({ error: 'Clés VAPID manquantes côté serveur.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const deliveryId = body?.record?.id;
  if (!deliveryId) {
    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 });
  }

  const { data: delivery } = await supabaseAdmin
    .from('notification_deliveries')
    .select('id, notification_id, subscription_id, status')
    .eq('id', deliveryId)
    .maybeSingle();

  if (!delivery || delivery.status !== 'PENDING') {
    return NextResponse.json({ ok: true }); // rien à faire (déjà traité ou introuvable)
  }

  const { data: notification } = await supabaseAdmin
    .from('notifications')
    .select('type, payload')
    .eq('id', delivery.notification_id)
    .maybeSingle();

  const { data: subscription } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('id', delivery.subscription_id)
    .maybeSingle();

  if (!notification || !subscription) {
    await supabaseAdmin
      .from('notification_deliveries')
      .update({ status: 'FAILED', error: 'Notification ou abonnement introuvable', last_attempted_at: new Date().toISOString() })
      .eq('id', deliveryId);
    return NextResponse.json({ ok: true });
  }

  const pushPayload = JSON.stringify({
    title: TYPE_LABELS[notification.type] || 'Nouvelle notification',
    url: notification.payload?.video_id ? `/videos/${notification.payload.video_id}` : '/notifications',
  });

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      pushPayload
    );
    await supabaseAdmin
      .from('notification_deliveries')
      .update({ status: 'SENT', last_attempted_at: new Date().toISOString() })
      .eq('id', deliveryId);
  } catch (err) {
    const statusCode = err?.statusCode;
    // 404/410 = abonnement définitivement mort (désinstallation, expiration...) :
    // on le désactive pour ne plus jamais réessayer dessus.
    if (statusCode === 404 || statusCode === 410) {
      await supabaseAdmin.from('push_subscriptions').update({ is_active: false }).eq('id', subscription.id);
    }
    await supabaseAdmin
      .from('notification_deliveries')
      .update({
        status: 'FAILED',
        error: String(err?.message || err),
        attempt_count: 1,
        last_attempted_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);
  }

  return NextResponse.json({ ok: true });
}
