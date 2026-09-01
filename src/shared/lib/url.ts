/**
 * Клиентское зеркало серверной `supabase/functions/_shared/url.ts` — только
 * для предпросмотра поля и автоопределения категории (следующий пункт).
 * Источник истины остаётся на сервере: он же и решает окончательно, что
 * ссылка распознана (CLAUDE.md — бизнес-правила и финальная валидация живут
 * на сервере).
 */

/** Подставляет https://, если пользователь не указал схему сам. */
export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return `https://${trimmed}`;
  }
}

/** Разбирает ссылку с той же нормализацией; null — если распознать не удалось. */
export function tryParseUrl(raw: string): URL | null {
  const normalized = normalizeUrlInput(raw);
  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

/**
 * Ссылка для показа: без схемы, без `www.` и без хвостовой косой черты.
 *
 * `https://` в тексте ничего не сообщает — переход всё равно делает кнопка со
 * своим полным адресом внутри, а лишние двенадцать символов съедают ширину
 * там, где место дорого (подпись под названием, метка кнопки). Хранимый
 * `projects.url` при этом не трогается: он остаётся полным и нормализованным,
 * иначе по нему нельзя было бы ни перейти, ни сверить занятость адреса.
 *
 * Неразбираемая строка возвращается как есть — показать её всё равно лучше,
 * чем пустоту.
 */
export function displayUrl(raw: string): string {
  const parsed = tryParseUrl(raw);
  if (!parsed) return raw;

  const host = parsed.hostname.startsWith('www.') ? parsed.hostname.slice(4) : parsed.hostname;
  const rest = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return `${host}${rest === '/' ? '' : rest}`;
}
