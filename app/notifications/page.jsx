'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const TYPE_LABELS = {
  FEEDBACK_CREATED: 'Nouveau retour',
  FEEDBACK_RESOLVED: 'Retour résolu',
  FEEDBACK_REPLY_CREATED: 'Réponse à un retour',
  VIDEO_READY_FOR_REVIEW: 'Vidéo à vérifier',
};

function fmtDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

// Conversion standard clé publique VAPID (base64url) -> Uint8Array, requise
// par l'API navigateur PushManager.subscribe().
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [error, setError] = useState(null);
  const [pushStatus, setPushStatus] = useState(null);

  async function load() {
    if (!supabase) {
      setError('Client Supabase non configuré.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      setNotLoggedIn(true);
      return;
    }

    const { data, error: notifError } = await supabase
      .from('notifications')
      .select('id, type, payload, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (notifError) {
      setError(notifError.message);
      return;
    }
    setNotifications(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((rows) => rows.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function enablePush() {
    setPushStatus('loading');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushStatus('Ce navigateur ne supporte pas les notifications push.');
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setPushStatus("Clé VAPID publique manquante côté app.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('Permission refusée.');
        return;
      }

      // On s'assure nous-mêmes qu'un service worker est enregistré, plutôt
      // que de dépendre uniquement de l'enregistrement passif fait dans
      // layout.jsx (qui pourrait ne pas encore être terminé à ce moment).
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/service-worker.js');
      }

      // "serviceWorker.ready" peut ne JAMAIS se résoudre si l'activation
      // échoue silencieusement — on ajoute donc une limite de temps pour ne
      // jamais rester bloqué indéfiniment sur "Activation...".
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Le service worker met trop de temps à démarrer. Recharge complètement la page (pas juste revenir dessus) et réessaie.")), 8000)
        ),
      ]);

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription || (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const json = subscription.toJSON();

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        setPushStatus('Session expirée, reconnecte-toi.');
        return;
      }

      const { error: insertError } = await supabase.from('push_subscriptions').insert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (insertError && !insertError.message.includes('duplicate')) {
        setPushStatus(`Erreur : ${insertError.message}`);
        return;
      }
      setPushStatus('✅ Notifications push activées sur cet appareil.');
    } catch (e) {
      setPushStatus(`Erreur : ${e.message}`);
    }
  }

  function targetUrl(n) {
    const videoId = n.payload?.video_id;
    return videoId ? `/videos/${videoId}` : null;
  }

  if (notLoggedIn) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <div className="card">
          <p>
            Tu n&apos;es pas connecté. Va sur <Link href="/activate">/activate</Link>.
          </p>
        </div>
      </main>
    );
  }
  if (error) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <p className="error">{error}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1>Notifications</h1>

      <div className="card">
        <p style={{ marginTop: 0 }}>Reçois une notification sur cet appareil même quand l&apos;app n&apos;est pas ouverte.</p>
        <button onClick={enablePush} disabled={pushStatus === 'loading'}>
          {pushStatus === 'loading' ? 'Activation...' : 'Activer les notifications push sur cet appareil'}
        </button>
        {pushStatus && pushStatus !== 'loading' && <p className="muted" style={{ marginBottom: 0 }}>{pushStatus}</p>}
      </div>

      {!notifications && <p className="muted">Chargement...</p>}
      {notifications && notifications.length === 0 && <p className="muted">Aucune notification pour l&apos;instant.</p>}

      {notifications &&
        notifications.map((n) => {
          const url = targetUrl(n);
          return (
            <div
              key={n.id}
              className="card"
              style={{
                background: n.is_read ? 'var(--color-surface)' : 'var(--color-highlight-bg)',
                borderColor: n.is_read ? 'var(--color-border)' : 'var(--color-highlight-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: n.is_read ? 400 : 600 }}>
                  {url ? (
                    <a
                      href={url}
                      onClick={() => !n.is_read && markRead(n.id)}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {TYPE_LABELS[n.type] || n.type}
                    </a>
                  ) : (
                    TYPE_LABELS[n.type] || n.type
                  )}
                </p>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {fmtDate(n.created_at)}
                </p>
              </div>
              {!n.is_read && (
                <button onClick={() => markRead(n.id)} className="secondary">
                  Marquer lu
                </button>
              )}
            </div>
          );
        })}
    </main>
  );
}
