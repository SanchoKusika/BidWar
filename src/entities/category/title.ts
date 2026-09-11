import { strings } from '@/shared/i18n/strings';

/**
 * Название категории на языке интерфейса.
 *
 * В базе `categories.title` лежит по-английски, и это не пользовательский
 * текст: список фиксированный и засеян первой миграцией. Поэтому подпись
 * печатается по `slug`, а название из базы остаётся запасным — категория,
 * которую добавят позже, покажется хотя бы по-английски, а не пустым местом.
 */
export function categoryTitle(slug: string, fallback: string): string {
  const known = strings.categories as unknown as Record<string, string | undefined>;
  return known[slug] ?? fallback;
}

/** Подпись плитки «все категории» — своей строки в базе у неё нет. */
export function allCategoriesTitle(): string {
  return strings.categories.all;
}
