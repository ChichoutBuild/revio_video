'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function VideosListPage() {
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

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

      // Requête directe depuis le navigateur, avec la clé publique — c'est
      // RLS (policy "video visibility") qui filtre, pas ce code.
      const { data: videoRows, error: videoError } = await supabase
        .from('videos')
        .select('id, name, category, created_at, current_version_id')
        .order('created_at', { ascending: false });

      if (videoError) {
        setError(videoError.message);
        return;
      }

      const versionIds = (videoRows || []).map((v) => v.current_version_id).filter(Boolean);
      let versionsById = {};
      if (versionIds.length) {
        const { data: versionRows } = await supabase
          .from('video_versions')
          .select('id, status, version_number')
          .in('id', versionIds);
        versionsById = Object.fromEntries((versionRows || []).map((v) => [v.id, v]));
      }

      setVideos((videoRows || []).map((v) => ({ ...v, version: versionsById[v.current_version_id] })));
    }
    run();
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Vidéos</h1>
        <a href="/videos/new">
          <button>+ Nouvelle vidéo</button>
        </a>
      </div>

      {notLoggedIn && (
        <div className="card">
          <p>
            Tu n&apos;es pas connecté. Va sur <a href="/activate">/activate</a> d&apos;abord.
          </p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {videos && videos.length === 0 && <p className="muted">Aucune vidéo pour l&apos;instant.</p>}

      {videos &&
        videos.map((v) => (
          <div className="card" key={v.id}>
            <p style={{ fontWeight: 600, margin: 0 }}>{v.name}</p>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {v.category} · V{v.version?.version_number ?? '?'} · {v.version?.status ?? '—'}
            </p>
          </div>
        ))}
    </main>
  );
}
