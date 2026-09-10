import { useShowcase, useOwnPosition, useTopProject, useFreeTodayBoard } from '@/entities/project';
import { useCategoryStats } from '@/entities/category';
import type {
  ShowcaseState,
  OwnPositionState,
  TopProjectState,
  TodayBoardState,
} from '@/entities/project';
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

/** Бесплатный топ за скользящие сутки — грузится, только когда вкладку открыли. */
export function useFreeToday(enabled: boolean, categoryId: number | null): TodayBoardState {
  return useFreeTodayBoard(enabled, categoryId);
}
