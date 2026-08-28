import { useShowcase, useOwnPosition, useTopProject } from '@/entities/project';
import { useCategoryStats } from '@/entities/category';
import type { ShowcaseState, OwnPositionState, TopProjectState } from '@/entities/project';
import type { CategoryStatsState } from '@/entities/category';

export function useFreeShowcase(): ShowcaseState {
  return useShowcase('free');
}

export function useFreeOwnPosition(
  categoryId: number | null,
  userId: string | null,
): OwnPositionState {
  return useOwnPosition('free', categoryId, userId);
}

export function useFreeCategories(): CategoryStatsState {
  return useCategoryStats('free');
}

export function useFreeTopProject(): TopProjectState {
  return useTopProject('free');
}
