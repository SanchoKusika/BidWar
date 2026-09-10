import {
  CURRENCY_SUFFIX,
  formatAgo,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import type { ActivityItem } from '@/shared/ui/ActivityFeed';
import type { StakeEvent, VoteEvent } from './types';

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

/**
 * Событие голосования → строка ленты. Голоса не форматируются валютой и не
 * сжимаются по умолчанию: они и так небольшие, а «1,2K голосов» на ленте из
 * трёх строк читается хуже точного числа.
 */
export function toVoteActivityItems(events: readonly VoteEvent[]): ActivityItem[] {
  return events.map((event) => ({
    id: String(event.id),
    kind: 'votes' as const,
    name: event.projectName,
    amount: formatVotes(event.amount, { compact: false }),
    unit: 'votes',
    ago: formatAgo(event.createdAt),
  }));
}
