import { useCallback } from 'react';
import {
  useShowcase,
  useOwnPosition,
  useTopProject,
  useTodayBoard,
  useMovement24h,
} from '@/entities/project';
import { useCategoryStats } from '@/entities/category';
import { fetchPaidLimits } from '@/shared/api';
import { useQuery } from '@/shared/lib/query';
import type {
  ShowcaseState,
  OwnPositionState,
  TopProjectState,
  TodayBoardState,
  Movement24h,
} from '@/entities/project';
import type { CategoryStatsState } from '@/entities/category';

export function usePaidShowcase(): ShowcaseState {
  return useShowcase('paid');
}

export function usePaidOwnPosition(
  categoryId: number | null,
  userId: string | null,
): OwnPositionState {
  return useOwnPosition('paid', categoryId, userId);
}

export function usePaidCategories(): CategoryStatsState {
  return useCategoryStats('paid');
}

export function usePaidTopProject(): TopProjectState {
  return useTopProject('paid');
}

/** Платный топ за скользящие сутки — грузится, только когда вкладку открыли. */
export function usePaidTodayBoard(enabled: boolean, categoryId: number | null): TodayBoardState {
  return useTodayBoard(enabled, categoryId);
}

/** Изменения позиции и ставки за сутки — обе стрелки на карточках. */
export function usePaidMovement(): ReadonlyMap<number, Movement24h> {
  return useMovement24h(true);
}

/**
 * Минимальный шаг ставки (app_config.paid_limits) — цена «занять место» и
 * подсказки. Через общий кэш: конфиг не меняется в пределах сессии, а без
 * него каждый возврат на вкладку заново ходил за одним и тем же числом.
 */
export function useMinPaidAmount(): number {
  const fetcher = useCallback(
    () =>
      fetchPaidLimits()
        .then((limits) => limits.minPaidAmount)
        // Остаёмся с запасным значением — это подсказка, не расчёт платежа.
        .catch(() => 50000),
    [],
  );

  return useQuery<number>('paid_limits', fetcher).data ?? 50000;
}
