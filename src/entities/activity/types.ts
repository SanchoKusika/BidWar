/**
 * Событие ставки из вьюхи `stake_activity`.
 *
 * Автора события (`stake_transactions.actor_user_id`) вьюха не отдаёт вовсе:
 * публично известно, по кому ударили, а не кто ударил. Скрывать его на клиенте
 * было бы поздно — он просто не выбран запросом (см. миграцию
 * 20260902120000_activity_and_today.sql).
 */
export type StakeEventType = 'raise' | 'attack_out' | 'attack_in';

export interface StakeEvent {
  id: number;
  projectId: number;
  projectName: string;
  /** Цель атаки: у `raise` её нет. */
  targetProjectId: number | null;
  targetName: string | null;
  type: StakeEventType;
  /** Всегда положительное — знак несёт тип события. */
  amount: number;
  createdAt: string;
}
