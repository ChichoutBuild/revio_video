'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function NewVideoPage() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('LONG');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (!supabase) {
        setError('Client Supabase non configuré.');
        setLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError('Tu dois être connecté. Va sur /activate.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, category, youtubeInput }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur inconnue');
      } else {
        setResult(json);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>Nouvelle vidéo</h1>

      <div className="card" style={{ background: '#eef0ff', borderColor: '#c7cbfa' }}>
        <p style={{ fontWeight: 600, marginTop: 0 }}>Comment obtenir le lien de ta vidéo ?</p>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>
            Mets ta vidéo en ligne sur YouTube (via un compte YouTube existant — pas besoin d&apos;en
            créer un spécifique pour l&apos;app)
          </li>
          <li>
            Au moment de la publication, choisis la visibilité <strong>« Non répertoriée »</strong>{' '}
            (pas « Publique », pas « Privée »)
          </li>
          <li>Une fois en ligne, copie le lien de la vidéo (bouton « Partager »)</li>
          <li>
            Colle-le ci-dessous — tu peux coller le lien complet ou juste les 11 derniers caractères
            après <code>v=</code>
          </li>
        </ol>
        <p className="muted" style={{ marginBottom: 0 }}>
          Une vidéo « non répertoriée » n&apos;apparaît jamais dans les résultats de recherche ni sur
          ta chaîne — seules les personnes ayant le lien exact peuvent la voir.
        </p>
      </div>

      <div className="card">
        <label>Nom de la vidéo (interne à l&apos;app)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma nouvelle vidéo" />
        <div style={{ height: 12 }} />
        <label>Catégorie</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e2ec' }}
        >
          <option value="LONG">Format long</option>
          <option value="SHORT">Short</option>
        </select>
        <div style={{ height: 12 }} />
        <label>Lien ou ID YouTube (vidéo non répertoriée)</label>
        <input
          value={youtubeInput}
          onChange={(e) => setYoutubeInput(e.target.value)}
          placeholder="https://youtube.com/watch?v=ukBnae57lb4 ou ukBnae57lb4"
        />
        <div style={{ height: 12 }} />
        <button onClick={handleCreate} disabled={loading || !name || !youtubeInput}>
          {loading ? 'Création...' : 'Créer'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <p>
            ✅ Vidéo créée : <strong>{result.name}</strong>
          </p>
          <p>
            <a href={`/videos/${result.videoId}`}>Ouvrir la vidéo</a> ·{' '}
            <a href="/videos">Voir la liste</a>
          </p>
        </div>
      )}
    </main>
  );
}
