import crypto from 'crypto';

function getPepper() {
  const pepper = process.env.AUTH_SECRET_PEPPER;
  if (!pepper) {
    throw new Error('AUTH_SECRET_PEPPER manquante côté serveur.');
  }
  return pepper;
}

// HMAC-SHA256 avec clé secrète externe à la base (pepper) — voir architecture
// v2.1 section 5.1 : plus robuste qu'un simple sha256(valeur) en cas de fuite
// complète de la base, puisque la clé n'y est jamais stockée.
export function hashSecret(value) {
  return crypto.createHmac('sha256', getPepper()).update(value).digest('hex');
}

export function generateRandomToken(prefix) {
  const raw = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}-${raw}` : raw;
}
