/**
 * Язык интерфейса — отдельным модулем без единого импорта.
 *
 * Иначе получается круг: словарь читает язык из настроек, а настройки должны
 * знать тип языка. Здесь только тип и чистая функция, поэтому от этого файла
 * зависят оба, а он — ни от кого.
 */

export const LOCALES = ['RU', 'EN'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'EN';

/**
 * Shell language → our code. `en-US`, `ru-RU` and the like come with a
 * region, so only the first part is compared.
 *
 * Anything unknown gets English: Russian is the only other language we
 * translate and answer for. Uzbek existed until the Russia-only pivot (tag
 * `archive/multi-market`) — a `uz` shell now lands on English too.
 */
export function localeFromLanguageCode(code: string | null): Locale {
  const base = (code ?? '').toLowerCase().split('-')[0];
  if (base === 'ru') return 'RU';
  return DEFAULT_LOCALE;
}
