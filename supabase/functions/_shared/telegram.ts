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

async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
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
const secretKeyCache = new Map<string, Uint8Array>();

async function getSecretKey(botToken: string): Promise<Uint8Array> {
  let key = secretKeyCache.get(botToken);
  if (!key) {
    key = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
    secretKeyCache.set(botToken, key);
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
 * Возвращает разобранные данные, если подпись верна, `auth_date` не старше 24ч
 * и поле `user` присутствует и разбирается — иначе `null`. Ничего не бросает:
 * подделанный/протухший initData — ожидаемый случай, а не исключительная ошибка.
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

/** Заголовок, которым Telegram подтверждает, что вебхук пришёл от него. */
export function verifyWebhookSecret(req: Request, expected: string): boolean {
  const provided = req.headers.get('x-telegram-bot-api-secret-token');
  return provided !== null && timingSafeEqual(provided, expected);
}
