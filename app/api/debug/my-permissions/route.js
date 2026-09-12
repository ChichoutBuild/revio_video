import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getRequestUser } from '../../../../lib/getRequestUser';

const CHECKED_CODES = [
  'USERS_CREATE', 'USERS_VIEW', 'VIDEOS_CREATE', 'VIDEOS_VIEW', 'VIDEOS_ASSIGN',
  'FEEDBACK_RESOLVE', 'ROLES_MANAGE', 'SETTINGS_MANAGE',
];

export async function GET(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 });
  }

  const actor = await getRequestUser(request, supabaseAdmin);
  if (!actor) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  const results = {};
  for (const code of CHECKED_CODES) {
    try {
      const { data } = await supabaseAdmin.rpc('has_permission', {
        p_user_id: actor.id,
        p_permission_code: code,
      });
      results[code] = data === true;
    } catch (e) {
      results[code] = null; // erreur de vérification, pas juste "refusé"
    }
  }

  return NextResponse.json({ userId: actor.id, permissions: results });
}
