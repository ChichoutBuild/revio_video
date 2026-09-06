// ---------------------------------------------------------------------------
// Sprint 0 — Prototype PWA du lecteur YouTube
// Utilise directement l'API officielle YouTube IFrame Player, la même sur
// tous les navigateurs (Safari iOS/macOS, Chrome Android/desktop, Edge
// Windows) — c'est ce qui supprime le besoin d'une implémentation séparée
// pour Windows, contrairement à la version Flutter native.
// ---------------------------------------------------------------------------

let ytPlayer = null;
let recreateCount = 0;
let rangeEndTarget = null;
let pollInterval = null;
let currentVideoId = null;

const els = {
  videoId: document.getElementById('video-id'),
  videoIdB: document.getElementById('video-id-b'),
  status: document.getElementById('status-line'),
  error: document.getElementById('error-line'),
  resumeBtn: document.getElementById('btn-resume'),
  recreateCount: document.getElementById('recreate-count'),
  platformInfo: document.getElementById('platform-info'),
  seekTime: document.getElementById('seek-time'),
  rangeStart: document.getElementById('range-start'),
  rangeEnd: document.getElementById('range-end'),
};

function fmt(seconds) {
  const s = Math.round(seconds || 0);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function showError(msg) {
  els.error.textContent = `Erreur lecteur : ${msg}`;
  els.error.classList.remove('hidden');
}
function clearError() {
  els.error.classList.add('hidden');
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

// --- Reprise de position (localStorage, jamais d'autoplay automatique) -----

function lastPositionKey(videoId) { return `last_position_${videoId}`; }

function saveLastPosition(videoId, seconds) {
  if (seconds > 2) localStorage.setItem(lastPositionKey(videoId), String(seconds));
}

function offerResumeIfAny(videoId) {
  const saved = parseFloat(localStorage.getItem(lastPositionKey(videoId)));
  if (!isNaN(saved) && saved > 2) {
    els.resumeBtn.textContent = `Reprendre à ${fmt(saved)}`;
    els.resumeBtn.classList.remove('hidden');
    els.resumeBtn.onclick = () => {
      ytPlayer.seekTo(saved, true);
      ytPlayer.playVideo(); // uniquement sur tap utilisateur explicite
      els.resumeBtn.classList.add('hidden');
    };
  } else {
    els.resumeBtn.classList.add('hidden');
  }
}

// --- Création / destruction du lecteur --------------------------------------

function createPlayer(videoId) {
  currentVideoId = videoId;
  clearError();

  if (ytPlayer) {
    try { ytPlayer.destroy(); } catch (e) { /* ignoré volontairement */ }
    ytPlayer = null;
  }

  ytPlayer = new YT.Player('player', {
    videoId: videoId,
    playerVars: {
      playsinline: 1,
      autoplay: 0, // jamais d'autoplay forcé au chargement
      rel: 0,
      controls: 1,
    },
    events: {
      onReady: () => {
        offerResumeIfAny(videoId);
        startPolling();
      },
      onStateChange: (e) => {
        const names = { '-1': 'non démarré', 0: 'terminé', 1: 'lecture', 2: 'pause', 3: 'buffering' };
        els.status.textContent = `État : ${names[e.data] ?? e.data}`;
      },
      onError: (e) => showError(describeError(e.data)),
    },
  });
}

function onYouTubeIframeAPIReady() {
  createPlayer(els.videoId.value.trim());
}
// L'API YouTube appelle cette fonction globale automatiquement une fois chargée.
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function recreatePlayer() {
  recreateCount++;
  els.recreateCount.textContent = String(recreateCount);
  createPlayer(currentVideoId || els.videoId.value.trim());
}

// --- Boucle de suivi de position (temps courant / durée + arrêt de plage) --

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
    const t = ytPlayer.getCurrentTime();
    const d = ytPlayer.getDuration();
    const stateText = els.status.textContent.split('  ')[0] || 'État : —';
    els.status.textContent = `${stateText}   ${fmt(t)} / ${fmt(d)}`;

    if (currentVideoId) saveLastPosition(currentVideoId, t);

    if (rangeEndTarget !== null && t >= rangeEndTarget - 0.5) {
      ytPlayer.pauseVideo();
      rangeEndTarget = null;
    }
  }, 250);
}

// --- Actions UI ---------------------------------------------------------

document.getElementById('btn-load').addEventListener('click', () => {
  if (!ytPlayer) { createPlayer(els.videoId.value.trim()); return; }
  ytPlayer.cueVideoById(els.videoId.value.trim()); // charge SANS lecture auto
  currentVideoId = els.videoId.value.trim();
  clearError();
  offerResumeIfAny(currentVideoId);
});

document.getElementById('btn-load-b').addEventListener('click', () => {
  const idB = els.videoIdB.value.trim();
  if (!idB || !ytPlayer) return;
  ytPlayer.cueVideoById(idB);
  currentVideoId = idB;
  clearError();
  offerResumeIfAny(idB);
});

document.getElementById('btn-play').addEventListener('click', () => ytPlayer && ytPlayer.playVideo());
document.getElementById('btn-pause').addEventListener('click', () => ytPlayer && ytPlayer.pauseVideo());
document.getElementById('btn-recreate').addEventListener('click', recreatePlayer);

document.getElementById('btn-seek').addEventListener('click', () => {
  if (!ytPlayer) return;
  ytPlayer.seekTo(parseFloat(els.seekTime.value) || 0, true);
});

document.getElementById('btn-range').addEventListener('click', () => {
  if (!ytPlayer) return;
  const start = parseFloat(els.rangeStart.value) || 0;
  const end = parseFloat(els.rangeEnd.value) || 0;
  if (end <= start) return;
  rangeEndTarget = end;
  ytPlayer.seekTo(start, true);
  ytPlayer.playVideo();
});

// --- Info plateforme (purement indicatif dans le rapport de test) ----------

els.platformInfo.textContent = navigator.userAgent;

// --- Enregistrement du service worker (installabilité PWA) -----------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('Service worker non enregistré :', err);
    });
  });
}
