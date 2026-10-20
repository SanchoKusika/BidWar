import {
  CURRENCY_SUFFIX,
  formatAgo,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
  DEFAULT_CURRENCY,
} from '@/shared/lib/format';
import type { ActivityItem } from '@/shared/ui/ActivityFeed';
import type { StakeEvent, VoteEvent } from './types';

export interface ActivityFormat {
  currency?: DisplayCurrency;
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
  { currency = DEFAULT_CURRENCY }: ActivityFormat = {},
): ActivityItem[] {
  return events.map((event) => ({
    id: String(event.id),
    kind: event.type === 'attack_out' ? 'attack' : 'raise',
    name: event.projectName,
    amount: formatMoney(event.amount, { currency }),
    unit: CURRENCY_SUFFIX[currency],
    ago: formatAgo(event.createdAt),
  }));
}

/**
 * A vote event → a feed row. Votes take no currency.
 */
export function toVoteActivityItems(events: readonly VoteEvent[]): ActivityItem[] {
  return events.map((event) => ({
    id: String(event.id),
    kind: 'votes' as const,
    name: event.projectName,
    amount: formatVotes(event.amount),
    unit: 'votes',
    ago: formatAgo(event.createdAt),
  }));
}
