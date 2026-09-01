import type { CategoryStat } from './types';

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me']);

/**
 * Хосты, где страница по ссылке — это всегда канал (лента автора), а не сайт
 * и не личный профиль: YouTube-канал, Rutube-канал, подкаст.
 */
const CHANNEL_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtu.be', 'rutube.ru']);

const PROFILE_HOSTS = new Set([
  'instagram.com',
  'linkedin.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'threads.net',
  'tiktok.com',
]);

function stripWww(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

/**
 * Юзернейм бота в Telegram почти всегда заканчивается на "bot" — это
 * единственный различимый по самой ссылке признак: канал, бот и личный
 * профиль на t.me/<имя> технически неотличимы иначе.
 */
function isTelegramBotUsername(pathname: string): boolean {
  const username = pathname.split('/').filter(Boolean)[0] ?? '';
  return /bot$/i.test(username);
}

/**
 * Подсказка категории по ссылке — только предзаполнение поля, не бизнес-
 * правило: пользователь всегда может выбрать другую плитку сам (см.
 * AddProjectSheet, флаг categoryTouched).
 *
 * Любой нераспознанный http(s)-адрес попадает в `sites`, а не остаётся без
 * подсказки. Раньше здесь молчали («лучше без подсказки, чем неверная»), но на
 * практике молчали почти всегда: под правило подходили только t.me и пять
 * соцсетей, а на обычной ссылке поле оставалось пустым и выглядело сломанным.
 * Ссылка на веб-страницу — это и есть сайт по умолчанию; Business и Services
 * говорят о том, что за страницей, а этого сам адрес не выдаёт. Промах видно
 * сразу и он снимается одним тапом, пустое поле — нет.
 *
 * null остаётся только для мусора, из которого не собирается URL.
 */
export function detectCategoryIdByUrl(url: URL, categories: CategoryStat[]): number | null {
  const hostname = stripWww(url.hostname.toLowerCase());

  let slug: string;
  if (TELEGRAM_HOSTS.has(hostname)) {
    slug = isTelegramBotUsername(url.pathname) ? 'bots' : 'channels';
  } else if (CHANNEL_HOSTS.has(hostname)) {
    slug = 'channels';
  } else if (PROFILE_HOSTS.has(hostname)) {
    slug = 'profiles';
  } else if (hostname.includes('.')) {
    slug = 'sites';
  } else {
    // Ещё не домен, а первые буквы: подсказка по «t» или «you» была бы шумом —
    // категория дёргалась бы на каждом нажатии, пока адрес не дописан.
    return null;
  }

  return categories.find((c) => c.slug === slug)?.categoryId ?? null;
}
