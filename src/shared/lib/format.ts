/**
 * Форматирование чисел двух экономик.
 *
 * Internally everything is counted in points, anchored 1 point = 1 rouble.
 * Roubles are the only display currency while the product is Russia-only; the
 * `currency` option stays as the seam a second display currency plugs into.
 * Multi-currency display with fixed rates lived here until the pivot — see the
 * `archive/multi-market` tag and the Obsidian note «13 Выход за пределы РФ».
 *
 * Число всегда идёт со своей единицей. Голое число — баг: это единственное,
 * что позволяет спутать деньги с голосами.
 */

import { strings } from '@/shared/i18n/strings';
export type DisplayCurrency = 'RUB';

export const DEFAULT_CURRENCY: DisplayCurrency = 'RUB';

export const CURRENCY_SUFFIX: Record<DisplayCurrency, string> = {
  RUB: '₽',
};

/** Units of a display currency per point. The anchor currency is 1 by definition. */
const rates: Record<DisplayCurrency, number> = {
  RUB: 1,
};

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
  { currency = DEFAULT_CURRENCY, compact = true }: MoneyOptions = {},
): string {
  const n = convert(points, currency);
  if (compact && n >= 1_000_000) return `${trim(n / 1_000_000)} ${strings.units.million}`;
  if (compact && n >= 100_000) return `${trim(n / 1000)} ${strings.units.thousand}`;
  if (n > 0 && n < 100) return trim(n);
  return group(Math.round(n));
}

/**
 * Очки → точное значение в валюте показа и обратно. Нужны там, где сумму не
 * только показывают, но и правят: поле ввода держит ОЧКИ (по ним считает
 * сервер), а человек видит и набирает свою валюту.
 *
 * `formatMoney` для этого не годится: он сокращает и округляет для читаемости,
 * а из его вывода нельзя вернуться к исходному числу.
 */
export function fromDisplay(amount: number, currency: DisplayCurrency): number {
  return Math.round((Number(amount) || 0) / rates[currency]);
}

/**
 * The amount in an input field. Whole roubles: a point is pinned to a rouble
 * one to one, so there are no fractions to show or type. A display currency
 * that is not the anchor would need decimals here again.
 */
export function formatEditable(points: number, currency: DisplayCurrency): string {
  return group(Math.round(convert(points, currency)));
}

export function formatVotes(value: number, { compact = true }: { compact?: boolean } = {}): string {
  const n = Number(value) || 0;
  if (compact && n >= 10_000)
    return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)} ${strings.units.thousand}`;
  return group(n);
}

/** Нейтральные счётчики — клики, просмотры. Не экономика: цвета единицы нет. */
export function formatCount(value: number): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} ${strings.units.million}`;
  if (n >= 10_000) return `${Math.round(n / 1000)} ${strings.units.thousand}`;
  return group(n);
}

/**
 * Сколько проект держит первое место — подпись рядом с короной.
 *
 * Единица растёт вместе со сроком: минуты, часы, дни с часами. Раньше счёт шёл
 * сразу в часах, и свежий лидер получал под корону «0 ч» — число, которое
 * выглядит как ошибка, хотя означает «только что занял». Первая минута так и
 * называется словами: «0 мин» ничем не лучше «0 ч».
 */
export function formatHeldDuration(sinceIso: string): string {
  const d = strings.duration;
  const ms = Date.now() - new Date(sinceIso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return d.justNow;

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return d.minutes(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return d.hours(hours);

  return d.daysHours(Math.floor(hours / 24), hours % 24);
}

/**
 * Полная дата — «28 August 2026» / «28 августа 2026».
 *
 * Локаль берётся из словаря, а не зашита: до трёх языков она была
 * зафиксирована в `en-GB`, и русский интерфейс печатал английские месяцы.
 * Порядок «день месяц год» одинаков во всех трёх — разница только в словах.
 */
export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(strings.duration.dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The date in a narrow slot — a stat tile, a tag: «13 сент. 2026» /
 * «13 Sep 2026». The full form cut off with an ellipsis in the project page's
 * four-number row. The Russian «г.» is dropped: the year is plain without it.
 */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date
    .toLocaleDateString(strings.duration.dateLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .replace(/\s*г\.$/, '');
}

/**
 * «Сколько назад» одной короткой строкой — подпись события в ленте.
 * Минуты до часа, часы до суток, дальше дни: точнее в ленте не нужно, а
 * секунды создавали бы иллюзию точности, которой у выборки нет.
 */
export function formatAgo(iso: string): string {
  const d = strings.duration;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  if (ms < 60_000) return d.justNow;

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return d.minutes(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return d.hours(hours);

  return d.days(Math.floor(hours / 24));
}

/** Короткая дата с временем для строки чека — «28 Aug, 14:05». */
export function formatReceiptDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(strings.duration.dateLocale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export function formatDelta(n: number): { text: string; dir: DeltaDirection } {
  if (!n) return { text: '0', dir: 'flat' };
  return { text: (n > 0 ? '+' : '−') + Math.abs(n), dir: n > 0 ? 'up' : 'down' };
}

/**
 * Сумма ровно та, что списали, и в той валюте, в которой списали.
 *
 * Отдельно от `formatMoney` намеренно: тот пересчитывает очки в валюту
 * зрителя, а чек пересчитывать нельзя никогда (04 Платежи и валюты). Здесь
 * число уже в своей валюте и остаётся собой — меняется только оформление.
 *
 * Валюта приходит из базы строкой: у списания может оказаться код, которого в
 * валютах показа нет вовсе. Тогда суффиксом становится сам код — это честнее,
 * чем подставить чужой знак.
 */
export function formatCharged(amount: number, currency: string): string {
  const known = CURRENCY_SUFFIX[currency as DisplayCurrency];
  return `${group(Math.round(Number(amount) || 0))} ${known ?? currency}`;
}
