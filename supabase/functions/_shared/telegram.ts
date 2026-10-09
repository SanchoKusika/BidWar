/**
 * Проверка initData и вебхук-секрета Telegram.
 *
 * Алгоритм — https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app,
 * сверено с живой документацией 28.08.2026:
 *   secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token)
 *   hash       = hex(HMAC_SHA256(key = secret_key, message = data_check_string))
 * data_check_string — все поля кроме hash, отсортированные по алфавиту,
 * `key=value` через `\n`. Сравнение — константное по времени.
 */

const AUTH_DATE_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * A sign-in on the site lives longer than a mini app launch: Telegram signs
 * the Login Widget answer once, and the site keeps it on the device as its
 * session. Thirty days, like an ordinary «remember me»; after that the
 * person signs in again.
 */
const LOGIN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
  /** Внутренний users.id реферера, если ссылка его содержала и он валиден по формату. */
  startParam: string | null;
}

// Явный ArrayBuffer вместо ArrayBufferLike: в свежих версиях TS параметр без
// generic-аргумента выводится как ArrayBufferLike, а Web Crypto (BufferSource)
// принимает только конкретный ArrayBuffer — без уточнения падает тайпчек.
async function hmacSha256(
  key: Uint8Array<ArrayBuffer>,
  message: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

// bot_token один и тот же в пределах жизни изолята — пересчитывать HMAC от
// него на каждый запрос незачем, кэшируем как getAdminClient() в identity.ts.
const secretKeyCache = new Map<string, Uint8Array<ArrayBuffer>>();

async function getSecretKey(botToken: string): Promise<Uint8Array<ArrayBuffer>> {
  let key = secretKeyCache.get(botToken);
  if (!key) {
    key = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
    secretKeyCache.set(botToken, key);
  }
  return key;
}

/** The Login Widget's key is a plain SHA-256 of the token, not an HMAC. */
const loginKeyCache = new Map<string, Uint8Array<ArrayBuffer>>();

async function getLoginKey(botToken: string): Promise<Uint8Array<ArrayBuffer>> {
  let key = loginKeyCache.get(botToken);
  if (!key) {
    key = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken)));
    loginKeyCache.set(botToken, key);
  }
  return key;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Обычный `===` на строках даёт тайминговую утечку длины совпадения. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Returns the parsed data when the signature holds and the data is fresh,
 * otherwise `null`. Never throws: forged or stale data is an expected case.
 *
 * Two signed formats arrive here. The mini app sends Telegram's `initData`
 * (a `user` field, the «WebAppData» key, 24 hours). The site sends the Login
 * Widget's answer as the same kind of query string (the user's fields at the
 * top level, a SHA-256 key, 30 days) — so every function that already checks
 * `initData` accepts a site sign-in without a line changed. The keys differ,
 * so one format can never pass as the other.
 */
export async function verifyInitData(
  initData: string,
  botToken: string,
): Promise<VerifiedInitData | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join('\n');

  if (!params.has('user')) return verifyLogin(params, hash, dataCheckString, botToken);

  const secretKey = await getSecretKey(botToken);
  const computedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqual(computedHash, hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  if (Date.now() / 1000 - authDate > AUTH_DATE_MAX_AGE_SECONDS) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (typeof user.id !== 'number') return null;

  return { user, authDate, startParam: params.get('start_param') };
}

/**
 * The Login Widget's answer (https://core.telegram.org/widgets/login):
 *   secret_key = SHA256(bot_token)
 *   hash       = hex(HMAC_SHA256(key = secret_key, message = data_check_string))
 * There is no referral parameter on the site: an invite works through the bot.
 */
async function verifyLogin(
  params: URLSearchParams,
  hash: string,
  dataCheckString: string,
  botToken: string,
): Promise<VerifiedInitData | null> {
  const computedHash = toHex(await hmacSha256(await getLoginKey(botToken), dataCheckString));
  if (!timingSafeEqual(computedHash, hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;
  if (Date.now() / 1000 - authDate > LOGIN_MAX_AGE_SECONDS) return null;

  const id = Number(params.get('id'));
  const firstName = params.get('first_name');
  if (!Number.isSafeInteger(id) || id <= 0 || !firstName) return null;

  const lastName = params.get('last_name');
  const username = params.get('username');
  const photoUrl = params.get('photo_url');
  const user: TelegramUser = {
    id,
    first_name: firstName,
    ...(lastName ? { last_name: lastName } : {}),
    ...(username ? { username } : {}),
    ...(photoUrl ? { photo_url: photoUrl } : {}),
  };

  return { user, authDate, startParam: null };
}

/**
 * Общий секрет в заголовке, сравнение константное по времени. Так доказывают
 * подлинность вызовы без Supabase-сессии: вебхук Telegram и расписание базы,
 * которое будит отправщика уведомлений.
 */
export function verifySecretHeader(req: Request, header: string, expected: string): boolean {
  const provided = req.headers.get(header);
  return provided !== null && timingSafeEqual(provided, expected);
}

/** Заголовок, которым Telegram подтверждает, что вебхук пришёл от него. */
export function verifyWebhookSecret(req: Request, expected: string): boolean {
  return verifySecretHeader(req, 'x-telegram-bot-api-secret-token', expected);
}
