'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function DbTestPage() {
  const [serverResult, setServerResult] = useState('Vérification...');
  const [serverOk, setServerOk] = useState(null);
  const [browserResult, setBrowserResult] = useState('Vérification...');
  const [browserOk, setBrowserOk] = useState(null);

  useEffect(() => {
    // 1. Accès côté serveur (clé service_role, via l'API route) — doit réussir.
    fetch('/api/db-status')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setServerOk(false);
          setServerResult(`Erreur : ${json.error}`);
        } else {
          setServerOk(true);
          setServerResult(`✅ Le serveur voit ${json.organizationsCount} organisation(s) via la clé privilégiée.`);
        }
      })
      .catch((err) => {
        setServerOk(false);
        setServerResult(`Erreur réseau : ${err.message}`);
      });

    // 2. Accès direct depuis le navigateur (clé anon) — doit être bloqué par
    // RLS puisqu'aucune policy n'existe encore : on attend 0 ligne, sans erreur.
    async function checkBrowserAccess() {
      if (!supabase) {
        setBrowserOk(null);
        setBrowserResult("Variables d'environnement manquantes côté navigateur.");
        return;
      }
      const { data, error } = await supabase.from('organizations').select('*');
      if (error) {
        setBrowserOk(null);
        setBrowserResult(`Erreur inattendue : ${error.message}`);
        return;
      }
      if (data.length === 0) {
        setBrowserOk(true);
        setBrowserResult('✅ 0 ligne visible depuis le navigateur — RLS bloque bien tout accès direct, comme attendu.');
      } else {
        setBrowserOk(false);
        setBrowserResult(
          `⚠️ ${data.length} ligne(s) visibles depuis le navigateur — ce n'est PAS normal à ce stade, RLS devrait tout bloquer.`
        );
      }
    }
    checkBrowserAccess();
  }, []);

  const boxStyle = (ok) => ({
    color: ok === false ? '#c0392b' : '#1c1c28',
    fontWeight: ok === false ? 600 : 400,
  });

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>Test de la base de données et de la sécurité (RLS)</h1>

      <div className="card">
        <p style={{ fontWeight: 600, marginTop: 0 }}>1. Accès côté serveur (clé privilégiée)</p>
        <p style={boxStyle(serverOk)}>{serverResult}</p>
      </div>

      <div className="card">
        <p style={{ fontWeight: 600, marginTop: 0 }}>2. Accès direct depuis ce navigateur (clé publique)</p>
        <p style={boxStyle(browserOk)}>{browserResult}</p>
      </div>

      <p className="muted">
        C'est normal et voulu que le point 2 affiche 0 ligne : tant qu'aucune "policy" RLS n'est
        créée, personne ne peut lire les données directement depuis le navigateur, même en
        connaissant la clé publique. C'est exactement le comportement de sécurité recherché.
      </p>
    </main>
  );
}
