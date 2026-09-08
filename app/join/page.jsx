'use client';

import { useState } from 'react';

export default function JoinPage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
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
      <h1>Rejoindre une équipe</h1>

      <div className="card">
        <label>Token d&apos;association</label>
        <div className="row">
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="TEAM-..." />
          <button onClick={handleJoin} disabled={loading || !token}>
            {loading ? 'Vérification...' : 'Rejoindre'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <p>
            ✅ Token valide — organisation : <strong>{result.organizationName}</strong>
          </p>
        </div>
      )}
    </main>
  );
}
