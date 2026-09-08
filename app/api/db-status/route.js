import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY manquante côté serveur (Vercel → Settings → Environment Variables)." },
      { status: 500 }
    );
  }

  const { count, error } = await supabaseAdmin
    .from('organizations')
    .select('*', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organizationsCount: count });
}
