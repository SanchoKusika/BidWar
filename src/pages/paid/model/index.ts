import { useShowcase, useOwnPosition } from '@/entities/project';
import { useCategoryStats } from '@/entities/category';
import type { ShowcaseState, OwnPositionState } from '@/entities/project';
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
