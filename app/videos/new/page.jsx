'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function NewVideoPage() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('LONG');
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
        body: JSON.stringify({ name, category }),
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

      <div className="card">
        <label>Nom</label>
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
        <button onClick={handleCreate} disabled={loading || !name}>
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
            <a href="/videos">Voir la liste des vidéos</a>
          </p>
        </div>
      )}
    </main>
  );
}
