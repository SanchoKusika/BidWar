/**
 * Telegram's OpenID Connect ID token (https://core.telegram.org/bots/telegram-login).
 *
 * The site's «Log in with Telegram» popup returns a signed JWT. It is checked
 * here against Telegram's published keys: the signature, the issuer, the
 * audience (our bot id — the Client ID in BotFather) and the expiry. No client
 * secret is involved: the popup flow has none, and the public keys are enough
 * to prove the token came from Telegram.
 */

export const TELEGRAM_ISSUER = 'https://oauth.telegram.org';
export const TELEGRAM_JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';

/** Clocks drift; a minute either way is the usual allowance. */
const CLOCK_SKEW_SECONDS = 60;

export interface TelegramIdClaims {
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  /** The Telegram user id — `sub` is a different, opaque identifier. */
  id: number;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
}

export interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

export type JwksSource = () => Promise<{ keys: Jwk[] }>;

let cachedKeys: { keys: Jwk[]; fetchedAt: number } | null = null;

/** Telegram's keys, cached for an hour per isolate — they rotate rarely. */
export const fetchTelegramJwks: JwksSource = async () => {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < 60 * 60 * 1000) return cachedKeys;
  const response = await fetch(TELEGRAM_JWKS_URL);
  if (!response.ok) throw new Error(`JWKS ${response.status}`);
  const body = (await response.json()) as { keys: Jwk[] };
  cachedKeys = { keys: body.keys ?? [], fetchedAt: Date.now() };
  return cachedKeys;
};

function base64UrlDecode(part: string): Uint8Array<ArrayBuffer> {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(part: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T;
  } catch {
    return null;
  }
}

/** RS256 by default in BotFather; ES256 is the other algorithm that keeps the profile scope. */
async function importKey(jwk: Jwk, alg: string): Promise<CryptoKey | null> {
  if (alg === 'RS256' && jwk.kty === 'RSA') {
    return crypto.subtle.importKey(
      'jwk',
      jwk as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  }
  if (alg === 'ES256' && jwk.kty === 'EC') {
    return crypto.subtle.importKey(
      'jwk',
      jwk as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
  }
  return null;
}

/**
 * The verified claims, or null — a forged, foreign, expired or malformed
 * token is an expected case, not an error. Throws only when Telegram's keys
 * cannot be fetched: that is our failure, not the person's.
 */
export async function verifyTelegramIdToken(
  token: string,
  botId: number,
  jwks: JwksSource = fetchTelegramJwks,
): Promise<TelegramIdClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  const header = decodeJson<{ alg?: string; kid?: string }>(headerPart);
  const claims = decodeJson<TelegramIdClaims>(payloadPart);
  if (!header?.alg || !claims) return null;

  const { keys } = await jwks();
  const candidates = keys.filter((key) => !header.kid || key.kid === header.kid);
  const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signature = base64UrlDecode(signaturePart);

  let valid = false;
  for (const jwk of candidates) {
    const key = await importKey(jwk, header.alg).catch(() => null);
    if (!key) continue;
    const params =
      header.alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
    if (await crypto.subtle.verify(params, key, signature, data)) {
      valid = true;
      break;
    }
  }
  if (!valid) return null;

  if (claims.iss !== TELEGRAM_ISSUER) return null;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.map(String).includes(String(botId))) return null;

  const now = Date.now() / 1000;
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) return null;
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > now) return null;
  if (!Number.isSafeInteger(claims.id) || claims.id <= 0) return null;

  return claims;
}
