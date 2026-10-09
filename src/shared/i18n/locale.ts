/**
 * Язык интерфейса — отдельным модулем без единого импорта.
 *
 * Иначе получается круг: словарь читает язык из настроек, а настройки должны
 * знать тип языка. Здесь только тип и чистая функция, поэтому от этого файла
 * зависят оба, а он — ни от кого.
 */

export const LOCALES = ['RU', 'EN'] as const;
export type Locale = (typeof LOCALES)[number];

/** Russian everywhere until the person picks English themselves. */
export const DEFAULT_LOCALE: Locale = 'RU';
