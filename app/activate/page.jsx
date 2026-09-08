'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ActivatePage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Erreur inconnue');
        setLoading(false);
        return;
      }

      if (!supabase) {
        setError('Client Supabase non configuré côté navigateur.');
        setLoading(false);
        return;
      }

      // C'est ici que le code à usage unique côté serveur devient une vraie
      // session Supabase persistante côté navigateur (access + refresh token).
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: json.hashedToken,
        type: 'email',
      });

      if (verifyError) {
        setError(`Échec de la vérification : ${verifyError.message}`);
        setLoading(false);
        return;
      }

      setStatus({
        userId: data.session?.user?.id,
        email: data.session?.user?.email,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>Activer mon compte</h1>

      <div className="card">
        <label>Code d&apos;activation</label>
        <div className="row">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: AB3XK9MQ2P" />
          <button onClick={handleActivate} disabled={loading || !code}>
            {loading ? 'Activation...' : 'Activer'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {status && (
        <div className="card">
          <p>✅ Compte activé et connecté avec une vraie session Supabase, persistante sur cet appareil.</p>
          <p className="muted">user id : {status.userId}</p>
          <p className="muted">email interne (jamais utilisé pour de vrai) : {status.email}</p>
        </div>
      )}
    </main>
  );
}
