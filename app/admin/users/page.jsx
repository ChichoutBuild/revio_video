'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminUsersPage() {
  const [organizationId, setOrganizationId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('VERIFICATEUR');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const headers = { 'Content-Type': 'application/json' };

      // Si une session existe, on l'envoie — nécessaire pour tout utilisateur
      // au-delà du tout premier de l'organisation (voir /api/org/users).
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/org/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ organizationId, displayName, role }),
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
        Le premier utilisateur d&apos;une organisation peut être créé sans connexion (il devient
        automatiquement ADMIN, quel que soit le rôle choisi ci-dessous). Pour tous les suivants, il
        faut être connecté (via <a href="/activate">/activate</a>) avec la permission USERS_CREATE.
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
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nathan" />
        <div style={{ height: 12 }} />
        <label>Rôle</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e2ec' }}
        >
          <option value="VERIFICATEUR">Vérificateur</option>
          <option value="ADMIN">Admin</option>
        </select>
        <div style={{ height: 12 }} />
        <button onClick={handleCreate} disabled={loading || !organizationId || !displayName}>
          {loading ? 'Création...' : 'Créer'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <p>
            ✅ Utilisateur créé : <strong>{result.displayName}</strong> — rôle {result.assignedRole}
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
