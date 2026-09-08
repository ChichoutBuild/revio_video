'use client';

import { useState } from 'react';

export default function AdminSetupPage() {
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/org/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: name }),
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
      <h1>Créer une organisation</h1>
      <p className="muted">
        ⚠️ Page temporaire, non protégée par un système de permissions (arrive au Sprint 3). Pour
        l&apos;instant, ne partage l&apos;adresse de cette page avec personne.
      </p>

      <div className="card">
        <label>Nom de l&apos;organisation</label>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon studio vidéo" />
          <button onClick={handleCreate} disabled={loading || !name}>
            {loading ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <p>
            ✅ Organisation créée : <strong>{result.organizationName}</strong>
          </p>
          <p>ID de l&apos;organisation (à réutiliser pour créer des utilisateurs) :</p>
          <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', background: '#f4f5f9', padding: 8, borderRadius: 6 }}>
            {result.organizationId}
          </p>
          <p>Token d&apos;association (copie-le maintenant, il ne sera plus jamais affiché) :</p>
          <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', background: '#f4f5f9', padding: 8, borderRadius: 6 }}>
            {result.token}
          </p>
        </div>
      )}
    </main>
  );
}
