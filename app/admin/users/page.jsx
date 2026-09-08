'use client';

import { useState } from 'react';

export default function AdminUsersPage() {
  const [organizationId, setOrganizationId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/org/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, displayName }),
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
      <h1>Créer un utilisateur</h1>
      <p className="muted">
        ⚠️ Page temporaire, non protégée (arrive au Sprint 3). Ne partage pas cette adresse.
      </p>

      <div className="card">
        <label>ID de l&apos;organisation</label>
        <input
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="uuid affiché lors de la création de l'organisation"
        />
        <div style={{ height: 12 }} />
        <label>Nom de l&apos;utilisateur</label>
        <div className="row">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nathan" />
          <button onClick={handleCreate} disabled={loading || !organizationId || !displayName}>
            {loading ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <p>
            ✅ Utilisateur créé : <strong>{result.displayName}</strong>
          </p>
          <p>Code d&apos;activation (à transmettre, valable 72h, usage unique) :</p>
          <p style={{ fontFamily: 'monospace', fontSize: 20, background: '#f4f5f9', padding: 8, borderRadius: 6 }}>
            {result.activationCode}
          </p>
        </div>
      )}
    </main>
  );
}
