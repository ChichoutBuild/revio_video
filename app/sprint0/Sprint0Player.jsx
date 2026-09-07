'use client';

import { useEffect, useRef, useState } from 'react';

function fmt(seconds) {
  const s = Math.round(seconds || 0);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function describeError(code) {
  switch (code) {
    case 2: return 'ID de vidéo invalide';
    case 5: return 'Erreur du lecteur HTML5';
    case 100: return 'Vidéo introuvable ou supprimée';
    case 101:
    case 150: return 'Vidéo non intégrable (restriction du propriétaire)';
    default: return `Erreur inconnue (code ${code})`;
  }
}

const STATE_NAMES = { '-1': 'non démarré', 0: 'terminé', 1: 'lecture', 2: 'pause', 3: 'buffering' };

export default function Sprint0Player() {
  const playerRef = useRef(null);          // instance YT.Player
  const rangeEndTargetRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const currentVideoIdRef = useRef(null);

  const [videoId, setVideoId] = useState('dQw4w9WgXcQ');
  const [videoIdB, setVideoIdB] = useState('');
  const [seekTime, setSeekTime] = useState('30');
  const [rangeStart, setRangeStart] = useState('10');
  const [rangeEnd, setRangeEnd] = useState('20');

  const [stateLabel, setStateLabel] = useState('—');
  const [timeLabel, setTimeLabel] = useState('00:00 / 00:00');
  const [error, setError] = useState(null);
  const [resumeAt, setResumeAt] = useState(null);
  const [recreateCount, setRecreateCount] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const [platformInfo, setPlatformInfo] = useState('');

  // Charge le script officiel de l'API YouTube une seule fois au montage.
  useEffect(() => {
    setPlatformInfo(navigator.userAgent);

    if (window.YT && window.YT.Player) {
      setApiReady(true);
    } else {
      window.onYouTubeIframeAPIReady = () => setApiReady(true);
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Crée le lecteur dès que l'API est prête.
  useEffect(() => {
    if (apiReady) {
      createPlayer(videoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  function lastPositionKey(id) {
    return `last_position_${id}`;
  }

  function saveLastPosition(id, seconds) {
    if (seconds > 2) localStorage.setItem(lastPositionKey(id), String(seconds));
  }

  function offerResumeIfAny(id) {
    const saved = parseFloat(localStorage.getItem(lastPositionKey(id)));
    setResumeAt(!isNaN(saved) && saved > 2 ? saved : null);
  }

  function startPolling() {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const t = p.getCurrentTime();
      const d = p.getDuration();
      setTimeLabel(`${fmt(t)} / ${fmt(d)}`);

      if (currentVideoIdRef.current) saveLastPosition(currentVideoIdRef.current, t);

      if (rangeEndTargetRef.current !== null && t >= rangeEndTargetRef.current - 0.5) {
        p.pauseVideo();
        rangeEndTargetRef.current = null;
      }
    }, 250);
  }

  function createPlayer(id) {
    currentVideoIdRef.current = id;
    setError(null);

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) { /* ignoré volontairement */ }
      playerRef.current = null;
    }

    playerRef.current = new window.YT.Player('player-container', {
      videoId: id,
      playerVars: { playsinline: 1, autoplay: 0, rel: 0, controls: 1 },
      events: {
        onReady: () => {
          offerResumeIfAny(id);
          startPolling();
        },
        onStateChange: (e) => setStateLabel(STATE_NAMES[e.data] ?? String(e.data)),
        onError: (e) => setError(describeError(e.data)),
      },
    });
  }

  function handleLoad() {
    const p = playerRef.current;
    if (!p) { createPlayer(videoId); return; }
    p.cueVideoById(videoId); // charge SANS lecture automatique
    currentVideoIdRef.current = videoId;
    setError(null);
    offerResumeIfAny(videoId);
  }

  function handleLoadB() {
    const p = playerRef.current;
    if (!p || !videoIdB) return;
    p.cueVideoById(videoIdB);
    currentVideoIdRef.current = videoIdB;
    setError(null);
    offerResumeIfAny(videoIdB);
  }

  function handleResume() {
    const p = playerRef.current;
    if (!p || resumeAt === null) return;
    p.seekTo(resumeAt, true);
    p.playVideo(); // uniquement sur tap utilisateur explicite, jamais automatique
    setResumeAt(null);
  }

  function handleRecreate() {
    setRecreateCount((c) => c + 1);
    createPlayer(currentVideoIdRef.current || videoId);
  }

  function handleSeek() {
    playerRef.current?.seekTo(parseFloat(seekTime) || 0, true);
  }

  function handleRange() {
    const p = playerRef.current;
    if (!p) return;
    const start = parseFloat(rangeStart) || 0;
    const end = parseFloat(rangeEnd) || 0;
    if (end <= start) return;
    rangeEndTargetRef.current = end;
    p.seekTo(start, true);
    p.playVideo();
  }

  return (
    <main style={{ maxWidth: 640, margin: '24px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>Sprint 0 — Prototype lecteur (Next.js)</h1>
        <p className="muted">{platformInfo}</p>
      </div>

      <section className="card">
        <label>video_id YouTube</label>
        <div className="row">
          <input value={videoId} onChange={(e) => setVideoId(e.target.value)} />
          <button onClick={handleLoad}>Charger</button>
        </div>
      </section>

      <section className="card">
        <div style={{ width: '100%', aspectRatio: '16/9', background: 'black', borderRadius: 8, overflow: 'hidden' }}>
          <div id="player-container" style={{ width: '100%', height: '100%' }} />
        </div>
        <p style={{ marginTop: 10, fontSize: 14 }}>État : {stateLabel} &nbsp;&nbsp; {timeLabel}</p>
        {error && <p className="error">Erreur lecteur : {error}</p>}
        {resumeAt !== null && (
          <button onClick={handleResume}>Reprendre à {fmt(resumeAt)}</button>
        )}
      </section>

      <section className="card">
        <div className="row wrap">
          <button onClick={() => playerRef.current?.playVideo()}>Play</button>
          <button onClick={() => playerRef.current?.pauseVideo()}>Pause</button>
          <button onClick={handleRecreate}>Recréer le lecteur ({recreateCount})</button>
        </div>
      </section>

      <section className="card">
        <label>Seek à (secondes)</label>
        <div className="row">
          <input type="number" value={seekTime} onChange={(e) => setSeekTime(e.target.value)} />
          <button onClick={handleSeek}>Seek</button>
        </div>
      </section>

      <section className="card">
        <p style={{ fontWeight: 600, marginTop: 0 }}>Lecture d&apos;une plage (tolérance ±0.5s)</p>
        <div className="row wrap">
          <div style={{ flex: 1 }}>
            <label>Début (s)</label>
            <input type="number" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Fin (s)</label>
            <input type="number" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>
          <button onClick={handleRange}>Lire la plage</button>
        </div>
      </section>

      <section className="card">
        <p style={{ fontWeight: 600, marginTop: 0 }}>Changement de vidéo rapide (test A→B)</p>
        <div className="row wrap">
          <input placeholder="autre video_id (B)" value={videoIdB} onChange={(e) => setVideoIdB(e.target.value)} />
          <button onClick={handleLoadB}>Charger B</button>
        </div>
      </section>
    </main>
  );
}
