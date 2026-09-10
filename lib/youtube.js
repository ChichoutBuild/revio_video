const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// Accepte : un ID brut, un lien youtube.com/watch?v=, youtu.be/, /embed/, /shorts/.
// Retourne null si rien de reconnaissable n'est trouvé — à l'appelant de
// traiter ça comme une entrée invalide (400), jamais de valeur "au hasard".
export function parseYoutubeVideoId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  if (ID_PATTERN.test(trimmed)) return trimmed;

  let url;
  try {
    url = new URL(trimmed);
  } catch (e) {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return ID_PATTERN.test(id) ? id : null;
  }

  if (host === 'youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && ID_PATTERN.test(id) ? id : null;
    }
    const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    const shortsMatch = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  }

  return null;
}
