const CACHE_NAME = 'sprint0-player-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie "network first, fallback cache" : pendant le développement du
// prototype, on veut toujours la dernière version si le réseau est dispo,
// mais l'app reste ouvrable hors-ligne (sauf la lecture YouTube elle-même,
// qui nécessite évidemment une connexion).
self.addEventListener('fetch', (event) => {
  // Ne jamais intercepter les requêtes vers YouTube — laisser passer normalement.
  if (event.request.url.includes('youtube.com') || event.request.url.includes('ytimg.com')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
