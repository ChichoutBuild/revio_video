// Extrait l'utilisateur Supabase à partir de l'en-tête "Authorization: Bearer <token>"
// envoyé par le client. Retourne null si absent ou invalide — à l'appelant de
// décider quoi faire (401, ou traitement "non connecté").
export async function getRequestUser(request, supabaseAdmin) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (e) {
    return null;
  }
}
