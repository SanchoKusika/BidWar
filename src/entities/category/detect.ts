import type { CategoryStat } from './types';

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me']);

const PROFILE_HOSTS = new Set([
  'instagram.com',
  'linkedin.com',
  'facebook.com',
  'x.com',
  'twitter.com',
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
 * AddProjectSheet, флаг categoryTouched). Ничего не находит ⇒ null, поле
 * остаётся как было — лучше отсутствие подсказки, чем уверенно неверная.
 */
export function detectCategoryIdByUrl(url: URL, categories: CategoryStat[]): number | null {
  const hostname = stripWww(url.hostname.toLowerCase());

  let slug: string | null = null;
  if (TELEGRAM_HOSTS.has(hostname)) {
    slug = isTelegramBotUsername(url.pathname) ? 'bots' : 'channels';
  } else if (PROFILE_HOSTS.has(hostname)) {
    slug = 'profiles';
  }

  if (!slug) return null;
  return categories.find((c) => c.slug === slug)?.categoryId ?? null;
}
