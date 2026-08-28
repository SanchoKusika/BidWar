import { useEffect, useState } from 'react';
import { useShowcase, useOwnPosition, useTopProject } from '@/entities/project';
import { useCategoryStats } from '@/entities/category';
import { fetchPaidLimits } from '@/shared/api';
import type { ShowcaseState, OwnPositionState, TopProjectState } from '@/entities/project';
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

/** Минимальный шаг ставки (app_config.paid_limits) — цена «занять место» и подсказки. */
export function useMinPaidAmount(): number {
  const [min, setMin] = useState(50000);

  useEffect(() => {
    let cancelled = false;
    fetchPaidLimits()
      .then((limits) => {
        if (!cancelled) setMin(limits.minPaidAmount);
      })
      .catch(() => {
        // Остаёмся с запасным значением — это подсказка, не расчёт платежа.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return min;
}
