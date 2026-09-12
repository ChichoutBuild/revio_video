'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const STATUS_LABELS = {
  BROUILLON: 'Brouillon',
  A_VERIFIER: 'À vérifier',
  EN_VERIFICATION: 'En vérification',
  MODIFICATIONS_DEMANDEES: 'Modifications demandées',
  APPROUVEE: 'Approuvée',
  PUBLIEE: 'Publiée',
  ARCHIVEE: 'Archivée',
};

export default function DashboardPage() {
  const [rows, setRows] = useState(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function run() {
      if (!supabase) {
        setError('Client Supabase non configuré.');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setNotLoggedIn(true);
        return;
      }

      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id, name, category, current_version_id, created_at')
        .order('created_at', { ascending: false });
      if (videosError) {
        setError(videosError.message);
        return;
      }

      const versionIds = (videos || []).map((v) => v.current_version_id).filter(Boolean);
      let versionsById = {};
      if (versionIds.length) {
        const { data: versions } = await supabase.from('video_versions').select('id, status').in('id', versionIds);
        versionsById = Object.fromEntries((versions || []).map((v) => [v.id, v]));
      }

      const { data: cats } = await supabase.from('feedback_categories').select('id, is_blocking');
      const blockingCategoryIds = new Set((cats || []).filter((c) => c.is_blocking).map((c) => c.id));

      const blockingCountByVersion = {};
      if (versionIds.length) {
        const { data: openFeedback } = await supabase
          .from('feedback')
          .select('video_version_id, category_id')
          .eq('status', 'OPEN')
          .in('video_version_id', versionIds);
        (openFeedback || []).forEach((f) => {
          if (blockingCategoryIds.has(f.category_id)) {
            blockingCountByVersion[f.video_version_id] = (blockingCountByVersion[f.video_version_id] || 0) + 1;
          }
        });
      }

      const { count: unread } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      setUnreadCount(unread || 0);

      setRows(
        (videos || []).map((v) => ({
          ...v,
          status: versionsById[v.current_version_id]?.status || null,
          blockingCount: blockingCountByVersion[v.current_version_id] || 0,
        }))
      );
    }
    run();
  }, []);

  if (notLoggedIn) {
    return (
      <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
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
      <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
        <p className="error">{error}</p>
      </main>
    );
  }
  if (!rows) {
    return (
      <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
        <p className="muted">Chargement...</p>
      </main>
    );
  }

  const counts = {
    aVerifier: rows.filter((r) => r.status === 'A_VERIFIER').length,
    enCours: rows.filter((r) => r.status === 'EN_VERIFICATION' || r.status === 'MODIFICATIONS_DEMANDEES').length,
    bloquees: rows.filter((r) => r.blockingCount > 0).length,
    terminees: rows.filter((r) => r.status === 'APPROUVEE' || r.status === 'PUBLIEE').length,
  };

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <div className="row">
          <a href="/notifications">
            <button style={{ background: unreadCount > 0 ? '#c0392b' : '#e2e2ec', color: unreadCount > 0 ? 'white' : '#1c1c28' }}>
              🔔 {unreadCount > 0 ? unreadCount : ''}
            </button>
          </a>
          <a href="/videos/new">
            <button>+ Nouvelle vidéo</button>
          </a>
        </div>
      </div>

      <div className="row wrap">
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{counts.aVerifier}</p>
          <p className="muted" style={{ margin: 0 }}>
            À vérifier
          </p>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{counts.enCours}</p>
          <p className="muted" style={{ margin: 0 }}>
            En cours
          </p>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: counts.bloquees > 0 ? '#c0392b' : undefined }}>
            {counts.bloquees}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Bloquées
          </p>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{counts.terminees}</p>
          <p className="muted" style={{ margin: 0 }}>
            Terminées
          </p>
        </div>
      </div>

      <div>
        <p style={{ fontWeight: 600 }}>Toutes les vidéos</p>
        {rows.length === 0 && <p className="muted">Aucune vidéo pour l&apos;instant.</p>}
        {rows.map((v) => (
          <a href={`/videos/${v.id}`} key={v.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              className="card"
              style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>{v.name}</p>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {v.category} · {STATUS_LABELS[v.status] || '—'}
                </p>
              </div>
              {v.blockingCount > 0 && <span style={{ color: '#c0392b', fontWeight: 600 }}>⚠ {v.blockingCount}</span>}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
