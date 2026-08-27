/**
 * Форматирование чисел двух экономик.
 *
 * Внутри всё считается в очках (1 очко = 1 сум по якорю). Валюта отображения —
 * настройка пользователя: списывается всегда в валюте провайдера, а показывается
 * в выбранной. Курсы фиксированные и приходят из app_config, живого фида нет
 * намеренно — топ не должен дёргаться от колебаний рынка.
 *
 * Число всегда идёт со своей единицей. Голое число — баг: это единственное,
 * что позволяет спутать деньги с голосами.
 */

export type DisplayCurrency = 'UZS' | 'USD' | 'RUB';

export const CURRENCY_SUFFIX: Record<DisplayCurrency, string> = {
  UZS: "so'm",
  USD: '$',
  RUB: '₽',
};

/** Курс к одному очку. Перезаписывается значениями из app_config при старте. */
const rates: Record<DisplayCurrency, number> = {
  UZS: 1,
  USD: 1 / 12100,
  RUB: 1 / 135,
};

export function setRates(next: Partial<Record<DisplayCurrency, number>>): void {
  Object.assign(rates, next);
}

export interface MoneyOptions {
  currency?: DisplayCurrency;
  compact?: boolean;
}

/** Разряды разделяются тонким пробелом, не запятой. */
export function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function trim(n: number): string {
  const s = n >= 100 ? String(Math.round(n)) : n.toFixed(1);
  return s.replace(/\.0$/, '');
}

export function convert(points: number, currency: DisplayCurrency): number {
  return (Number(points) || 0) * rates[currency];
}

export function formatMoney(
  points: number,
  { currency = 'UZS', compact = true }: MoneyOptions = {},
): string {
  const n = convert(points, currency);
  if (compact && n >= 1_000_000) return `${trim(n / 1_000_000)} mln`;
  if (compact && n >= 100_000) return `${trim(n / 1000)}K`;
  if (n > 0 && n < 100) return trim(n);
  return group(Math.round(n));
}

export function formatVotes(value: number, { compact = true }: { compact?: boolean } = {}): string {
  const n = Number(value) || 0;
  if (compact && n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return group(n);
}

/** Нейтральные счётчики — клики, просмотры. Не экономика: цвета единицы нет. */
export function formatCount(value: number): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} mln`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return group(n);
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export function formatDelta(n: number): { text: string; dir: DeltaDirection } {
  if (!n) return { text: '0', dir: 'flat' };
  return { text: (n > 0 ? '+' : '−') + Math.abs(n), dir: n > 0 ? 'up' : 'down' };
}
