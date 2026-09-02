import { CURRENCY_SUFFIX, formatAgo, formatMoney, type DisplayCurrency } from '@/shared/lib/format';
import type { ActivityItem } from '@/shared/ui/ActivityFeed';
import type { StakeEvent } from './types';

export interface ActivityFormat {
  currency?: DisplayCurrency;
  compact?: boolean;
}

/**
 * Событие леджера → строка ленты.
 *
 * Позиции после события в строке нет: истории рангов мы не храним (01 Механики,
 * «позиция нигде не хранится»), а подставить туда текущий ранг значило бы
 * приписать старому событию сегодняшнее число.
 */
export function toActivityItems(
  events: readonly StakeEvent[],
  { currency = 'UZS', compact = true }: ActivityFormat = {},
): ActivityItem[] {
  return events.map((event) => ({
    id: String(event.id),
    kind: event.type === 'attack_out' ? 'attack' : 'raise',
    name: event.projectName,
    amount: formatMoney(event.amount, { currency, compact }),
    unit: CURRENCY_SUFFIX[currency],
    ago: formatAgo(event.createdAt),
  }));
}
