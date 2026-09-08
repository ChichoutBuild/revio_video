import { createClient } from '@supabase/supabase-js';

// ⚠️ Ce fichier utilise la clé service_role, qui contourne complètement RLS.
// Il ne doit JAMAIS être importé depuis un composant marqué 'use client',
// uniquement depuis du code serveur (API routes, Server Components).
// SUPABASE_SERVICE_ROLE_KEY (sans préfixe NEXT_PUBLIC_) n'est donc jamais
// envoyée au navigateur par Next.js.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;
