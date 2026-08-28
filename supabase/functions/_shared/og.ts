/**
 * OG-фетч с защитой от SSRF (02 Архитектура.md): произвольный пользовательский
 * URL мог бы превратить это в бесплатный сканер внутренней сети и облачных
 * метаданных, поэтому каждый адрес — включая редиректы — проверяется до
 * запроса, а не после.
 *
 * Проверка идёт через Deno.resolveDns(): ловит домены со статической
 * A/AAAA-записью на приватный адрес (включая заход доменом на
 * 169.254.169.254). DNS-rebinding (запись меняется между проверкой и самим
 * fetch) этим не закрывается — нужен свой HTTP-клиент с ручным резолвом
 * соединения, для MVP это лишнее. Резолв в этом рантайме проверен вживую
 * (28.08.2026) и работает; если он всё же откажет — отказ закрывает доступ,
 * а не открывает: молча пропустить непроверенный хост значило бы свести
 * весь смысл файла на нет.
 */

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 6000;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_NAME_LENGTH = 120;
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

export interface OgResult {
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: 'ok' | 'failed';
}

class BlockedUrlError extends Error {}

function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 127 || a === 10 || a === 0 || a >= 224) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, включая cloud metadata
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('::ffff:')) return isBlockedIp(lower.slice('::ffff:'.length));
  if (
    lower.startsWith('fe80:') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    return true; // fe80::/10
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 (ULA)
  return false;
}

async function assertHostAllowed(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) throw new BlockedUrlError(`Хост запрещён: ${hostname}`);
  if (isBlockedIp(lower)) throw new BlockedUrlError(`IP вне разрешённого диапазона: ${hostname}`);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) return; // публичный v4-литерал, уже проверен выше

  let v4: string[];
  let v6: string[];
  try {
    [v4, v6] = await Promise.all([
      Deno.resolveDns(hostname, 'A').catch(() => [] as string[]),
      Deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
    ]);
  } catch (error) {
    // Отказ резолва закрывает доступ, а не открывает: непроверенный хост —
    // не то же самое, что проверенный и чистый (код-ревью PR #12).
    throw new BlockedUrlError(`Не удалось проверить хост: ${hostname} (${String(error)})`);
  }

  const resolved = [...v4, ...v6];
  if (resolved.length === 0) throw new BlockedUrlError(`Не удалось разрешить хост: ${hostname}`);
  if (resolved.some((ip) => isBlockedIp(ip))) {
    throw new BlockedUrlError(`Хост резолвится в приватный адрес: ${hostname}`);
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchWithGuards(startUrl: string): Promise<{ finalUrl: string; body: string }> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw new BlockedUrlError(`Схема не разрешена: ${parsed.protocol}`);
    }
    await assertHostAllowed(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'user-agent': 'BidWarBot/1.0 (+https://bidwar.world)' },
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new BlockedUrlError('Редирект без Location');
      current = new URL(location, parsed).toString();
      continue;
    }

    if (!response.ok) throw new BlockedUrlError(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) throw new BlockedUrlError(`Не HTML: ${contentType}`);

    const reader = response.body?.getReader();
    if (!reader) throw new BlockedUrlError('Пустое тело ответа');

    let received = 0;
    const chunks: Uint8Array[] = [];
    // <head> почти всегда укладывается в первые сотни КБ — обрезаем тело,
    // а не отказываемся от страницы целиком.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      chunks.push(value);
      if (received >= MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
    }

    return { finalUrl: current, body: new TextDecoder().decode(concatChunks(chunks)) };
  }

  throw new BlockedUrlError('Слишком много редиректов');
}

function extractMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const direct = new RegExp(
    `<meta[^>]+property=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${escaped}["']`,
    'i',
  );
  return html.match(direct)?.[1] ?? html.match(reversed)?.[1] ?? null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  return match?.trim() || null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Без названия';
  }
}

function resolveMaybeRelative(value: string, base: string): string | null {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

/**
 * Никогда не бросает: сбой сети/SSRF-блок/что угодно даёт `status: 'failed'`
 * и имя по хосту вместо ошибки — публикация проекта не блокируется
 * (02 Архитектура.md, таблица «Обработка ошибок»).
 */
export async function fetchOg(url: string): Promise<OgResult> {
  try {
    const { finalUrl, body } = await fetchWithGuards(url);

    const name = decodeHtmlEntities(
      extractMeta(body, 'og:title') || extractTitle(body) || hostnameOf(finalUrl),
    ).slice(0, MAX_NAME_LENGTH);

    const rawDescription = extractMeta(body, 'og:description');
    const description = rawDescription
      ? decodeHtmlEntities(rawDescription).slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

    const rawImage = extractMeta(body, 'og:image');
    const imageUrl = rawImage ? resolveMaybeRelative(rawImage, finalUrl) : null;

    return { name, description, imageUrl, status: 'ok' };
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        fn: 'og',
        message: 'fetch failed',
        url,
        error: String(error),
      }),
    );
    return { name: hostnameOf(url), description: null, imageUrl: null, status: 'failed' };
  }
}
