import { createClient } from '@supabase/supabase-js';

// NEXT_PUBLIC_* : ces variables sont volontairement visibles côté navigateur —
// c'est normal et attendu pour l'URL du projet et la clé "anon" (clé publique,
// protégée uniquement par les policies RLS côté base de données, jamais par
// le secret lui-même). Ne JAMAIS mettre la clé "service_role" ici.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Volontairement défensif : si les variables d'environnement ne sont pas
// encore configurées (ex. premier déploiement avant réglage sur Vercel),
// on exporte `null` plutôt que de faire planter toute l'app au build.
// Chaque appelant doit vérifier `supabase` avant de l'utiliser.
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
