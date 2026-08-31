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
