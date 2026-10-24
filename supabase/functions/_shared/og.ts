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

import { imageSize, type ImageSize } from './image_size.ts';

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 6000;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_NAME_LENGTH = 120;
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

/** An image's size sits in its first bytes; a JPEG's EXIF can push it some way in. */
const IMAGE_PROBE_BYTES = 64 * 1024;
const IMAGE_TIMEOUT_MS = 3000;
/** How many of a page's icons are looked at. */
const MAX_ICON_PROBES = 6;
/** Below this an icon blurs in the 52–64 px tile it is shown in. */
const MIN_ICON_SIDE = 48;
/** Wider (or taller) than this an image is a banner, not a face. */
const MAX_SQUARE_RATIO = 1.25;

export interface OgResult {
  name: string;
  description: string | null;
  /** The project's picture — see pickAvatar. */
  imageUrl: string | null;
  status: 'ok' | 'failed';
}

class BlockedUrlError extends Error {}

export function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 127 || a === 10 || a === 0 || a >= 224) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, включая cloud metadata
    // Shared address space (CGNAT) — clouds use it for internal networks.
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking, not routable
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('::ffff:')) return isBlockedIp(lower.slice('::ffff:'.length));
  // NAT64 (64:ff9b::/96) carries an IPv4 address inside; through a NAT64
  // gateway it reaches that address, private ones included.
  if (lower.startsWith('64:ff9b:')) return true;
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

interface Fetched {
  finalUrl: string;
  headers: Headers;
  bytes: Uint8Array;
}

/**
 * GET with the host check at every hop, one deadline for the whole exchange —
 * headers and body — and a cap on how much of the body is read. `accept` sees
 * the content type before any of the body is.
 */
async function guardedFetch(
  startUrl: string,
  options: { timeoutMs: number; maxBytes: number; accept: (contentType: string) => boolean },
): Promise<Fetched> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw new BlockedUrlError(`Схема не разрешена: ${parsed.protocol}`);
    }
    await assertHostAllowed(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'user-agent': 'BidWarBot/1.0 (+https://bidwar.world)' },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location) throw new BlockedUrlError('Редирект без Location');
        current = new URL(location, parsed).toString();
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new BlockedUrlError(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!options.accept(contentType)) {
        await response.body?.cancel();
        throw new BlockedUrlError(`Не тот тип: ${contentType}`);
      }

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
        if (received >= options.maxBytes) {
          await reader.cancel();
          break;
        }
      }

      return { finalUrl: current, headers: response.headers, bytes: concatChunks(chunks) };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new BlockedUrlError('Слишком много редиректов');
}

async function fetchPage(url: string): Promise<{ finalUrl: string; body: string }> {
  const { finalUrl, bytes } = await guardedFetch(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_BODY_BYTES,
    accept: (contentType) => contentType.includes('text/html'),
  });
  return { finalUrl, body: new TextDecoder().decode(bytes) };
}

/**
 * The size of the picture at `url`, or null: unreachable, blocked, or not a
 * picture at all — sentry.io answers /apple-touch-icon.png with a page and a
 * 200. Read from the first bytes, under the same guards as the page itself.
 */
export async function probeImage(url: string): Promise<ImageSize | null> {
  try {
    const { headers, bytes } = await guardedFetch(url, {
      timeoutMs: IMAGE_TIMEOUT_MS,
      maxBytes: IMAGE_PROBE_BYTES,
      accept: (contentType) => !contentType.includes('text/html'),
    });
    // A picture its server keeps to its own site is no picture for ours: the
    // browser refuses it (click.uz answers every image «same-site»), and the
    // card fell back to a letter while the server saw a fine PNG.
    const policy = headers.get('cross-origin-resource-policy')?.trim().toLowerCase();
    if (policy && policy !== 'cross-origin') return null;
    return imageSize(bytes);
  } catch {
    return null;
  }
}

/**
 * Ищет мета-тег и по `property=`, и по `name=`: Open Graph пишут через
 * property, а обычное описание страницы — `<meta name="description">`, то есть
 * ровно тот текст, который показывает поисковик под ссылкой. Раньше смотрели
 * только на property, поэтому у сайта без Open Graph описания не было вовсе.
 *
 * Кавычки вокруг имени обязательны в регулярке: без них `og:image` совпал бы с
 * идущим раньше `og:image:width`.
 */
function extractMeta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const direct = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
    'i',
  );
  const value = html.match(direct)?.[1] ?? html.match(reversed)?.[1] ?? null;
  // Пустой content — не находка: пусть подхватится следующий источник.
  return value?.trim() ? value : null;
}

/** Первый непустой из списка мета-тегов. */
function firstMeta(html: string, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = extractMeta(html, key);
    if (value) return value;
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  return match?.trim() || null;
}

/**
 * Named entities the pages actually use, plus numeric ones. Applied to links
 * too, not only to text: `?w=180&amp;h=180` taken as is sends `amp;h=180`,
 * and a signed address — LinkedIn's — answers that with a 403.
 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
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
    return new URL(decodeHtmlEntities(value.trim()), base).toString();
  } catch {
    return null;
  }
}

/** An attribute of one tag: double-quoted, single-quoted or bare (`rel=icon`). */
function attribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

/** The biggest side a `sizes` attribute names; null for none or `any`. */
function declaredSize(sizes: string | null): number | null {
  const sides = [...(sizes ?? '').matchAll(/(\d+)\s*x\s*(\d+)/gi)].map((m) =>
    Math.min(Number(m[1]), Number(m[2])),
  );
  return sides.length > 0 ? Math.max(...sides) : null;
}

/**
 * The page's icons, the most promising first. What the markup says about each
 * is only a hint — `rel="icon"` with no size is as often 1024 px (raycast.com)
 * as 16 — so the order decides only which ones get looked at.
 *
 * Raster icons go before SVG: a favicon drawn for a dark browser tab is often
 * a one-colour SVG, and on a light tile it vanishes. `mask-icon` is such a
 * stencil by definition and is not taken at all.
 *
 * Two addresses no tag names are tried as well: plenty of sites serve
 * /apple-touch-icon.png and a 256 px /favicon.ico without saying so —
 * click.uz and slack.com among them.
 */
function iconCandidates(html: string, finalUrl: string): string[] {
  const scored: Array<{ url: string; score: number }> = [];

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    const apple = rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed');
    if (!apple && !rel.includes('icon') && !rel.includes('fluid-icon')) continue;

    const href = attribute(tag, 'href');
    const url = href ? resolveMaybeRelative(href, finalUrl) : null;
    if (!url || !/^https?:/.test(url)) continue;

    const svg =
      (attribute(tag, 'type') ?? '').includes('svg') || /\.svg$/i.test(new URL(url).pathname);
    const declared = declaredSize(attribute(tag, 'sizes'));
    // Apple's own default is 180; a bare `icon` is usually the 16–32 px tab icon.
    const score = svg ? 100 : (declared ?? (apple ? 180 : 32));
    scored.push({ url, score });
  }

  for (const [path, score] of [
    ['/apple-touch-icon.png', 150],
    ['/favicon.ico', 24],
  ] as const) {
    const url = resolveMaybeRelative(path, finalUrl);
    if (url) scored.push({ url, score });
  }

  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.url)
    .filter((url) => !seen.has(url) && Boolean(seen.add(url)));
}

/** What a page says about itself, before any picture is fetched. */
export interface PageCard {
  name: string;
  description: string | null;
  /** og:image or twitter:image: a profile's picture — or a site's social banner. */
  socialImage: string | null;
  /** The page's own icons, the most promising first. */
  icons: string[];
}

/**
 * Разбор <head> в карточку проекта. Вынесен из fetchOg отдельно от сети, чтобы
 * его можно было проверить тестом (og_test.ts).
 *
 * Порядок источников один и тот же для всех трёх полей: Open Graph → Twitter
 * Card → обычные теги страницы. У t.me og:description — это текст блока «О
 * себе» канала или профиля, а og:image — аватар; у сайта без Open Graph то же
 * место занимают <title> и <meta name="description">.
 */
export function parseOgHtml(html: string, finalUrl: string): PageCard {
  const name = decodeHtmlEntities(
    firstMeta(html, ['og:title', 'twitter:title']) || extractTitle(html) || hostnameOf(finalUrl),
  ).slice(0, MAX_NAME_LENGTH);

  // Описание живёт в карточке одной строкой под названием, а многострочное «О
  // себе» канала приезжает с переносами — схлопываем их в пробелы здесь, а не
  // в вёрстке: в базе тогда лежит ровно то, что показывается.
  const rawDescription = firstMeta(html, ['og:description', 'twitter:description', 'description']);
  const description = rawDescription
    ? decodeHtmlEntities(rawDescription)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_DESCRIPTION_LENGTH)
    : null;

  const rawImage = firstMeta(html, ['og:image', 'twitter:image']);
  const socialImage = rawImage ? resolveMaybeRelative(rawImage, finalUrl) : null;

  return { name, description, socialImage, icons: iconCandidates(html, finalUrl) };
}

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me']);

/** t.me paths that are Telegram's own pages, not a username. */
const TELEGRAM_SERVICE_PATHS = new Set([
  'joinchat',
  'addstickers',
  'addemoji',
  'addtheme',
  'share',
  'proxy',
  'socks',
  'setlanguage',
  'login',
  'iv',
  'c',
  'i',
]);

/**
 * The address of a Telegram account's current picture, or null for a link
 * without a public username (an invite, a private chat).
 *
 * og:image of a t.me page points at a CDN file that lives for days: every
 * picture on the board taken that way answered 404 within a month, and the
 * cards fell back to a letter. `t.me/i/userpic/320/<username>.jpg` stays the
 * same and redirects to whatever the picture is today.
 */
export function telegramUserpic(projectUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(projectUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let username: string | undefined;

  if (TELEGRAM_HOSTS.has(host)) {
    const [first, second] = url.pathname.split('/').filter(Boolean);
    username = first === 's' ? second : first;
    if (username && TELEGRAM_SERVICE_PATHS.has(username.toLowerCase())) return null;
  } else if (host.endsWith('.t.me')) {
    username = host.slice(0, -'.t.me'.length);
  }

  // Public usernames: a letter first, then letters, digits and underscores;
  // Telegram's own bots keep three-letter ones (@gif, @vid, @pic).
  if (!username || !/^[a-z][a-z0-9_]{2,31}$/i.test(username)) return null;
  return `https://t.me/i/userpic/320/${username}.jpg`;
}

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);

/** instagram.com paths that are Instagram's own pages or a post, not a handle. */
const INSTAGRAM_SERVICE_PATHS = new Set([
  'accounts',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
  'direct',
  'about',
  'legal',
]);

/**
 * Instagram answers a cloud address with its login page under the profile's
 * own URL: og:title "Instagram", the app's logo and "Create an account or log
 * in". Taken as is, every Instagram project was called Instagram and described
 * by the login form. The handle in the link is the one true thing left, so it
 * becomes the name and the form's text is dropped; the logo stays as the
 * picture — it at least says where the link leads.
 */
export function withoutInstagramLoginWall(card: PageCard, pageUrl: string): PageCard {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return card;
  }
  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return card;
  if (card.name.trim().toLowerCase() !== 'instagram') return card;

  const [handle] = url.pathname.split('/').filter(Boolean);
  if (!handle || INSTAGRAM_SERVICE_PATHS.has(handle.toLowerCase())) return card;
  if (!/^[a-z0-9._]{1,30}$/i.test(handle)) return card;

  return { ...card, name: `@${handle}`, description: null };
}

/**
 * Platforms where a page belongs to someone — a channel, a profile, a
 * company — and its og:image is their picture. Anywhere else og:image is a
 * 1200×630 banner made for link previews.
 */
const PROFILE_HOSTS = new Set([
  'github.com',
  'gitlab.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'instagram.com',
  'facebook.com',
  'threads.net',
  'tiktok.com',
  'youtube.com',
  'm.youtube.com',
  'rutube.ru',
  'dzen.ru',
  'vk.com',
  'm.vk.com',
  'ok.ru',
  'twitch.tv',
  'behance.net',
  'dribbble.com',
]);

function onProfilePlatform(pageUrl: string): boolean {
  try {
    const url = new URL(pageUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    // The platform's own front page is a site like any other.
    return PROFILE_HOSTS.has(host) && url.pathname.replace(/\/+$/, '') !== '';
  } catch {
    return false;
  }
}

/** Google's copy of a site's icon: it knows the touch icons pages do not link. */
function googleFavicon(pageUrl: string): string | null {
  try {
    const host = new URL(pageUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    return null;
  }
}

function side(size: ImageSize): number {
  return Math.min(size.width, size.height);
}

function squarish(size: ImageSize): boolean {
  if (size.width <= 0 || size.height <= 0) return false;
  const ratio = size.width / size.height;
  return ratio <= MAX_SQUARE_RATIO && ratio >= 1 / MAX_SQUARE_RATIO;
}

export type ImageProbe = (url: string) => Promise<ImageSize | null>;

interface ProbedIcon {
  url: string;
  size: ImageSize;
}

function biggest(icons: readonly ProbedIcon[]): ProbedIcon | null {
  return icons.reduce<ProbedIcon | null>(
    (best, icon) => (!best || side(icon.size) > side(best.size) ? icon : best),
    null,
  );
}

/**
 * The picture a project is shown by — its face, the way a browser tab and
 * outbid.lol show a site, not its link-preview banner. A square cut from the
 * middle of a 1200×630 banner was what the feed used to show for sites: half
 * a headline, a slice of an illustration.
 *
 * - A Telegram account: its stable userpic address (see telegramUserpic).
 * - A page on a profile platform (github.com/<user>, a YouTube channel, a
 *   LinkedIn company): its og:image, when that is square — that is the face.
 * - Any other site: the biggest of its own raster icons that really is a
 *   square picture of at least MIN_ICON_SIDE; then an SVG icon; then Google's
 *   copy of the icon; then a square og:image (some sites put the logo there);
 *   then the best small icon; and only then the banner, which the card shows
 *   whole rather than cut. Nothing usable — no picture, and the card shows
 *   the project's letter.
 *
 * Every candidate is fetched (its first bytes) before it is trusted: a
 * declared icon can turn out to be an HTML page, and sizes are rarely given.
 */
export async function pickAvatar(
  card: PageCard,
  pageUrl: string,
  probe: ImageProbe = probeImage,
): Promise<string | null> {
  const userpic = telegramUserpic(pageUrl);
  if (userpic) return userpic;

  const icons = card.icons.slice(0, MAX_ICON_PROBES);
  const google = googleFavicon(pageUrl);
  const [iconSizes, googleSize, socialSize] = await Promise.all([
    Promise.all(icons.map((url) => probe(url))),
    google ? probe(google) : null,
    card.socialImage ? probe(card.socialImage) : null,
  ]);

  const social = card.socialImage && socialSize && squarish(socialSize) ? card.socialImage : null;
  if (social && onProfilePlatform(pageUrl)) return social;

  const usable: ProbedIcon[] = [];
  icons.forEach((url, i) => {
    const size = iconSizes[i];
    if (size && squarish(size)) usable.push({ url, size });
  });
  const raster = usable.filter((icon) => !icon.size.vector);

  const big = biggest(raster.filter((icon) => side(icon.size) >= MIN_ICON_SIDE));
  if (big) return big.url;
  const vector = usable.find((icon) => icon.size.vector);
  if (vector) return vector.url;
  if (google && googleSize && squarish(googleSize) && side(googleSize) >= MIN_ICON_SIDE) {
    return google;
  }
  if (social) return social;
  // The banner last — and only one that is a picture a browser will show.
  return biggest(raster)?.url ?? (socialSize ? card.socialImage : null);
}

/**
 * Никогда не бросает: сбой сети/SSRF-блок/что угодно даёт `status: 'failed'`
 * и имя по хосту вместо ошибки — публикация проекта не блокируется
 * (02 Архитектура.md, таблица «Обработка ошибок»).
 */
export async function fetchOg(url: string): Promise<OgResult> {
  try {
    const { finalUrl, body } = await fetchPage(url);
    // The handle is read from the link the owner gave: Instagram may answer it
    // from /accounts/login/, where no handle is left to read.
    const card = withoutInstagramLoginWall(parseOgHtml(body, finalUrl), url);
    const imageUrl = telegramUserpic(url) ?? (await pickAvatar(card, finalUrl));
    return { name: card.name, description: card.description, imageUrl, status: 'ok' };
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
    // A Telegram account's picture needs no page: the username is the address.
    return {
      name: hostnameOf(url),
      description: null,
      imageUrl: telegramUserpic(url),
      status: 'failed',
    };
  }
}
