import { useEffect, useState } from 'react';
import { fetchCategoryStats } from './api';
import type { CategoryStat } from './types';
import type { ShowcaseType } from '@/entities/project';

export interface CategoryStatsState {
  categories: CategoryStat[];
  loading: boolean;
}

/** Плитки категорий для текущей витрины — грузятся один раз на тип. */
export function useCategoryStats(type: ShowcaseType): CategoryStatsState {
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchCategoryStats(type)
      .then((stats) => {
        if (!cancelled) setCategories(stats);
      })
      .catch(() => {
        // Плитки категорий — вспомогательная навигация, не критичный путь:
        // тихо остаёмся с пустым списком, витрина всё равно работает без него.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type]);

  return { categories, loading };
}
