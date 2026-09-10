'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

function fmt(seconds) {
  const s = Math.round(seconds || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function VideoDetailPage() {
  const { id } = useParams();
  const playerRef = useRef(null);
  const [apiReady, setApiReady] = useState(false);

  const [video, setVideo] = useState(null);
  const [version, setVersion] = useState(null);
  const [source, setSource] = useState(null);
  const [categories, setCategories] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [replies, setReplies] = useState({});
  const [sessionToken, setSessionToken] = useState(null);
  const [myUserId, setMyUserId] = useState(null);

  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [feedbackType, setFeedbackType] = useState('TIMECODE');
  const [categoryId, setCategoryId] = useState('');
  const [content, setContent] = useState('');
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [replyDrafts, setReplyDrafts] = useState({});

  // --- Chargement des données -------------------------------------------
  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoadError('Client Supabase non configuré.');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setNotLoggedIn(true);
        return;
      }
      setSessionToken(sessionData.session.access_token);
      setMyUserId(sessionData.session.user.id);

      const { data: videoRow, error: videoError } = await supabase
        .from('videos')
        .select('id, name, category, current_version_id')
        .eq('id', id)
        .maybeSingle();
      if (videoError || !videoRow) {
        setLoadError("Vidéo introuvable, ou tu n'y as pas accès.");
        return;
      }
      setVideo(videoRow);

      const { data: versionRow } = await supabase
        .from('video_versions')
        .select('id, version_number, status')
        .eq('id', videoRow.current_version_id)
        .maybeSingle();
      setVersion(versionRow);

      const { data: sourceRow } = await supabase
        .from('video_sources')
        .select('external_id, type')
        .eq('video_version_id', videoRow.current_version_id)
        .maybeSingle();
      setSource(sourceRow);

      const { data: categoryRows } = await supabase
        .from('feedback_categories')
        .select('id, name, color, icon, is_blocking, sort_order')
        .order('sort_order', { ascending: true });
      setCategories(categoryRows || []);
      if (categoryRows && categoryRows.length) setCategoryId(categoryRows[0].id);

      await loadFeedback(videoRow.current_version_id);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadFeedback(videoVersionId) {
    const { data: feedbackRows } = await supabase
      .from('feedback')
      .select('id, type, start_time_seconds, end_time_seconds, content, status, category_id, author_id, created_at, resolution_note')
      .eq('video_version_id', videoVersionId)
      .order('created_at', { ascending: false });
    setFeedbackList(feedbackRows || []);

    const ids = (feedbackRows || []).map((f) => f.id);
    if (ids.length) {
      const { data: replyRows } = await supabase
        .from('feedback_replies')
        .select('id, feedback_id, author_id, content, created_at')
        .in('feedback_id', ids)
        .order('created_at', { ascending: true });
      const grouped = {};
      (replyRows || []).forEach((r) => {
        grouped[r.feedback_id] = grouped[r.feedback_id] || [];
        grouped[r.feedback_id].push(r);
      });
      setReplies(grouped);
    }
  }

  // --- Lecteur YouTube -----------------------------------------------------
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
    } else {
      window.onYouTubeIframeAPIReady = () => setApiReady(true);
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    if (apiReady && source?.external_id && !playerRef.current) {
      playerRef.current = new window.YT.Player('yt-player', {
        videoId: source.external_id,
        playerVars: { playsinline: 1, autoplay: 0, rel: 0, controls: 1 },
      });
    }
  }, [apiReady, source]);

  function getCurrentTime() {
    try {
      return playerRef.current?.getCurrentTime?.() ?? 0;
    } catch (e) {
      return 0;
    }
  }

  function seekTo(seconds) {
    try {
      playerRef.current?.seekTo?.(seconds, true);
    } catch (e) {
      /* lecteur pas encore prêt */
    }
  }

  // --- Création de feedback ------------------------------------------------
  async function handleSubmitFeedback() {
    setSubmitError(null);
    if (!content.trim()) {
      setSubmitError('Écris un commentaire.');
      return;
    }
    if (!categoryId) {
      setSubmitError('Choisis une catégorie.');
      return;
    }

    const payload = {
      video_version_id: version.id,
      author_id: myUserId,
      category_id: categoryId,
      type: feedbackType,
      content: content.trim(),
      start_time_seconds: null,
      end_time_seconds: null,
    };

    if (feedbackType === 'TIMECODE') {
      payload.start_time_seconds = Math.floor(getCurrentTime());
    } else if (feedbackType === 'RANGE') {
      if (rangeStart === null || rangeEnd === null || rangeEnd <= rangeStart) {
        setSubmitError('Marque un début et une fin valides (fin après le début).');
        return;
      }
      payload.start_time_seconds = rangeStart;
      payload.end_time_seconds = rangeEnd;
    }

    setSubmitting(true);
    const { error } = await supabase.from('feedback').insert(payload);
    setSubmitting(false);

    if (error) {
      setSubmitError(`Impossible d'ajouter ce retour : ${error.message}`);
      return;
    }

    setContent('');
    setRangeStart(null);
    setRangeEnd(null);
    await loadFeedback(version.id);
  }

  async function handleReply(feedbackId) {
    const text = (replyDrafts[feedbackId] || '').trim();
    if (!text) return;
    const { error } = await supabase
      .from('feedback_replies')
      .insert({ feedback_id: feedbackId, author_id: myUserId, content: text });
    if (!error) {
      setReplyDrafts((d) => ({ ...d, [feedbackId]: '' }));
      await loadFeedback(version.id);
    }
  }

  async function handleResolve(feedbackId) {
    if (!sessionToken) return;
    const res = await fetch(`/api/feedback/${feedbackId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      await loadFeedback(version.id);
    } else {
      const json = await res.json();
      alert(json.error || 'Impossible de résoudre ce retour.');
    }
  }

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  // --- Rendu ----------------------------------------------------------------
  if (notLoggedIn) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <div className="card">
          <p>
            Tu n&apos;es pas connecté. Va sur <a href="/activate">/activate</a> d&apos;abord.
          </p>
        </div>
      </main>
    );
  }
  if (loadError) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <p className="error">{loadError}</p>
      </main>
    );
  }
  if (!video) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <p className="muted">Chargement...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>{video.name}</h1>
        <p className="muted">
          {video.category} · V{version?.version_number} · {version?.status}
        </p>
      </div>

      <div className="card">
        <div style={{ width: '100%', aspectRatio: '16/9', background: 'black', borderRadius: 8, overflow: 'hidden' }}>
          <div id="yt-player" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      <div className="card">
        <p style={{ fontWeight: 600, marginTop: 0 }}>Ajouter un retour</p>

        {categories.length === 0 ? (
          <p className="error">
            Aucune catégorie de retour configurée pour ton organisation. Demande à ton administrateur
            d&apos;exécuter le script <code>supabase/005_backfill_feedback_categories.sql</code>.
          </p>
        ) : (
          <>
            <div className="row wrap" style={{ marginBottom: 12 }}>
              {['GLOBAL', 'TIMECODE', 'RANGE'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFeedbackType(t)}
                  style={{ background: feedbackType === t ? '#3730a3' : '#e2e2ec', color: feedbackType === t ? 'white' : '#1c1c28' }}
                >
                  {t === 'GLOBAL' ? 'Global' : t === 'TIMECODE' ? 'Timecode' : 'Plage'}
                </button>
              ))}
            </div>

            {feedbackType === 'TIMECODE' && (
              <p className="muted">Le retour sera positionné à la position actuelle du lecteur au moment de l&apos;envoi.</p>
            )}

            {feedbackType === 'RANGE' && (
              <div className="row wrap" style={{ marginBottom: 12 }}>
                <button onClick={() => setRangeStart(Math.floor(getCurrentTime()))}>
                  Marquer début {rangeStart !== null ? `(${fmt(rangeStart)})` : ''}
                </button>
                <button onClick={() => setRangeEnd(Math.floor(getCurrentTime()))}>
                  Marquer fin {rangeEnd !== null ? `(${fmt(rangeEnd)})` : ''}
                </button>
              </div>
            )}

            <label>Catégorie</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e2ec', marginBottom: 12 }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>

            <label>Commentaire</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e2ec', fontFamily: 'inherit', fontSize: 15 }}
            />

            <div style={{ height: 12 }} />
            <button onClick={handleSubmitFeedback} disabled={submitting}>
              {submitting ? 'Envoi...' : 'Envoyer le retour'}
            </button>
            {submitError && <p className="error">{submitError}</p>}
          </>
        )}
      </div>

      <div>
        <p style={{ fontWeight: 600 }}>Retours ({feedbackList.length})</p>
        {feedbackList.length === 0 && <p className="muted">Aucun retour pour l&apos;instant.</p>}

        {feedbackList.map((f) => {
          const cat = categoryById[f.category_id];
          return (
            <div className="card" key={f.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ background: cat?.color || '#ccc', color: 'white', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>
                    {cat?.icon} {cat?.name}
                  </span>{' '}
                  {f.type === 'TIMECODE' && (
                    <button onClick={() => seekTo(f.start_time_seconds)} style={{ background: 'transparent', color: '#3730a3', padding: 0 }}>
                      {fmt(f.start_time_seconds)}
                    </button>
                  )}
                  {f.type === 'RANGE' && (
                    <button onClick={() => seekTo(f.start_time_seconds)} style={{ background: 'transparent', color: '#3730a3', padding: 0 }}>
                      {fmt(f.start_time_seconds)} → {fmt(f.end_time_seconds)}
                    </button>
                  )}
                </div>
                {f.status === 'RESOLVED' ? (
                  <span className="muted">✅ Résolu</span>
                ) : (
                  <button onClick={() => handleResolve(f.id)}>Résoudre</button>
                )}
              </div>
              <p style={{ margin: '8px 0' }}>{f.content}</p>

              {(replies[f.id] || []).map((r) => (
                <p key={r.id} className="muted" style={{ margin: '4px 0 4px 12px', borderLeft: '2px solid #e2e2ec', paddingLeft: 8 }}>
                  {r.content}
                </p>
              ))}

              <div className="row" style={{ marginTop: 8 }}>
                <input
                  placeholder="Répondre..."
                  value={replyDrafts[f.id] || ''}
                  onChange={(e) => setReplyDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                />
                <button onClick={() => handleReply(f.id)}>Répondre</button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
