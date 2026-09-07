'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SupabaseTestPage() {
  const [status, setStatus] = useState('En cours de vérification...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function check() {
      // supabase === null : variables d'environnement absentes ou incomplètes.
      // C'est une erreur de configuration Vercel, pas un problème Supabase —
      // on distingue les deux cas explicitement pour ne pas induire en erreur.
      if (!supabase) {
        setIsError(true);
        setStatus(
          "Variables d'environnement manquantes (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Vérifie Vercel → Settings → Environment Variables, puis redéploie."
        );
        return;
      }

      const { data, error } = await supabase.rpc('ping');

      if (error) {
        setIsError(true);
        setStatus(`Erreur lors de l'appel à Supabase : ${error.message}`);
        return;
      }

      if (data === 'pong') {
        setIsError(false);
        setStatus('✅ Connexion à Supabase réussie (réponse reçue : "pong")');
      } else {
        setIsError(true);
        setStatus(`Réponse inattendue : ${JSON.stringify(data)}`);
      }
    }
    check();
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
      <h1>Test de connexion Supabase</h1>
      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ color: isError ? '#c0392b' : '#1c1c28', fontWeight: isError ? 600 : 400 }}>
          {status}
        </p>
      </div>
    </main>
  );
}
