import { useCallback } from 'react';
import { useQuery, type QueryState } from '@/shared/lib/query';
import { getPlatform } from '@/shared/platform';
import { fetchTasks, type TaskBoard } from './api';

/**
 * Задания одного человека и его баланс.
 *
 * Ключ включает `initData`, потому что ответ зависит от того, кто спрашивает:
 * под общим ключом два аккаунта в одной вкладке увидели бы чужие выполненные
 * задания из кэша.
 *
 * Живёт в сущности, а не в модели страницы заданий: тем же ответом пользуется
 * профиль — в нём из этих же чисел собирается реферальная карточка, и второй
 * запрос за теми же данными разошёлся бы с первым.
 */
export function useTaskBoard(): QueryState<TaskBoard> {
  const initData = getPlatform().getInitData();
  const fetcher = useCallback(() => fetchTasks(initData ?? ''), [initData]);
  return useQuery(initData ? `tasks:${initData}` : null, fetcher);
}
