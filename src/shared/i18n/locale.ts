/**
 * Язык интерфейса — отдельным модулем без единого импорта.
 *
 * Иначе получается круг: словарь читает язык из настроек, а настройки должны
 * знать тип языка. Здесь только тип и чистая функция, поэтому от этого файла
 * зависят оба, а он — ни от кого.
 */

export const LOCALES = ['RU', 'UZ', 'EN'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'EN';

/**
 * Язык оболочки → наш код. `en-US`, `ru-RU` и подобные приходят с регионом,
 * поэтому сравнивается только первая часть.
 *
 * Незнакомый язык — английский: русский и узбекский мы переводим и отвечаем за
 * них, а подставлять человеку язык, которого в словаре нет, значит показать ему
 * английский под чужой вывеской.
 */
export function localeFromLanguageCode(code: string | null): Locale {
  const base = (code ?? '').toLowerCase().split('-')[0];
  if (base === 'ru') return 'RU';
  if (base === 'uz') return 'UZ';
  return DEFAULT_LOCALE;
}
