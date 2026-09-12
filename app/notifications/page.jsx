'use client';

import { useEffect, useState } from 'react';
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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [error, setError] = useState(null);

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

  function targetUrl(n) {
    const videoId = n.payload?.video_id;
    return videoId ? `/videos/${videoId}` : null;
  }

  if (notLoggedIn) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <div className="card">
          <p>
            Tu n&apos;es pas connecté. Va sur <a href="/activate">/activate</a>.
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
                background: n.is_read ? 'white' : '#eef0ff',
                borderColor: n.is_read ? '#e2e2ec' : '#c7cbfa',
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
                <button onClick={() => markRead(n.id)} style={{ background: '#e2e2ec', color: '#1c1c28' }}>
                  Marquer lu
                </button>
              )}
            </div>
          );
        })}
    </main>
  );
}
