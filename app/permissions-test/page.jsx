'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function PermissionsTestPage() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  useEffect(() => {
    async function run() {
      if (!supabase) {
        setError('Client Supabase non configuré.');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setNotLoggedIn(true);
        return;
      }

      const res = await fetch('/api/debug/my-permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur inconnue');
      } else {
        setResult(json);
      }
    }
    run();
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>Mes permissions</h1>

      {notLoggedIn && (
        <div className="card">
          <p>Tu n&apos;es pas connecté dans ce navigateur.</p>
          <p className="muted">
            Va sur <a href="/activate">/activate</a> avec un code d&apos;activation d&apos;abord.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <p className="muted">user id : {result.userId}</p>
          <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(result.permissions).map(([code, value]) => (
                <tr key={code} style={{ borderTop: '1px solid #e2e2ec' }}>
                  <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>{code}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                    {value === true ? '✅ autorisé' : value === false ? '⛔ refusé' : '⚠️ erreur'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
