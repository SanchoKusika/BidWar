import { useCallback } from 'react';
import { fetchCategoryStats } from './api';
import { useQuery } from '@/shared/lib/query';
import type { CategoryStat } from './types';
import type { ShowcaseType } from '@/entities/project';

export interface CategoryStatsState {
  categories: CategoryStat[];
  loading: boolean;
  /** Пересчитать после события, которое меняет пул/лидера (например, Add Project). */
  retry: () => void;
}

const EMPTY: CategoryStat[] = [];

/** Плитки категорий для текущей витрины — один запрос на тип, дальше из кэша. */
export function useCategoryStats(type: ShowcaseType): CategoryStatsState {
  const fetcher = useCallback(
    () =>
      fetchCategoryStats(type).catch(() => {
        // Плитки категорий — вспомогательная навигация, не критичный путь:
        // тихо остаёмся с пустым списком, витрина всё равно работает без него.
        return EMPTY;
      }),
    [type],
  );

  const query = useQuery<CategoryStat[]>(`categories:${type}`, fetcher);
  return { categories: query.data ?? EMPTY, loading: query.loading, retry: query.refresh };
}
