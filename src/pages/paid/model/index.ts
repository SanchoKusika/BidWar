import { useCallback } from 'react';
import {
  useShowcase,
  useOwnPosition,
  useTopProject,
  useTodayBoard,
  useMovement24h,
} from '@/entities/project';
import { useCategoryStats } from '@/entities/category';
import { fetchPaidLimits, PAID_LIMITS_FALLBACK } from '@/shared/api';
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

export interface PaymentBounds {
  /** Минимальный шаг ставки — цена «занять место» и подсказки. */
  min: number;
  /** Provider ceiling for a single payment. */
  max: number;
}

const FALLBACK_BOUNDS: PaymentBounds = {
  min: PAID_LIMITS_FALLBACK.minPaidAmount,
  max: PAID_LIMITS_FALLBACK.maxPaymentAmount,
};

/**
 * Границы одного платежа (app_config.paid_limits). Через общий кэш: конфиг не
 * меняется в пределах сессии, а без него каждый возврат на вкладку заново
 * ходил за одним и тем же числом.
 */
export function usePaymentBounds(): PaymentBounds {
  const fetcher = useCallback(
    () =>
      fetchPaidLimits()
        .then((limits) => ({ min: limits.minPaidAmount, max: limits.maxPaymentAmount }))
        // Остаёмся с запасным значением — это подсказка, не расчёт платежа.
        .catch(() => FALLBACK_BOUNDS),
    [],
  );

  return useQuery<PaymentBounds>('paid_limits', fetcher).data ?? FALLBACK_BOUNDS;
}
