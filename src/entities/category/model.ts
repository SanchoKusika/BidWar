import { useEffect, useState } from 'react';
import { fetchCategoryStats } from './api';
import type { CategoryStat } from './types';
import type { ShowcaseType } from '@/entities/project';

export interface CategoryStatsState {
  categories: CategoryStat[];
  loading: boolean;
  /** Пересчитать после события, которое меняет пул/лидера (например, Add Project). */
  retry: () => void;
}

interface Result {
  key: string;
  categories: CategoryStat[];
}

const EMPTY: Result = { key: '', categories: [] };

/** Плитки категорий для текущей витрины — грузятся один раз на тип. */
export function useCategoryStats(type: ShowcaseType): CategoryStatsState {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<Result>(EMPTY);

  const currentKey = `${type}:${reloadToken}`;
  const loading = result.key !== currentKey;

  useEffect(() => {
    let cancelled = false;
    const key = `${type}:${reloadToken}`;

    fetchCategoryStats(type)
      .then((stats) => {
        if (!cancelled) setResult({ key, categories: stats });
      })
      .catch(() => {
        // Плитки категорий — вспомогательная навигация, не критичный путь:
        // тихо остаёмся с пустым списком, витрина всё равно работает без него.
        if (!cancelled) setResult({ key, categories: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [type, reloadToken]);

  return { categories: result.categories, loading, retry: () => setReloadToken((n) => n + 1) };
}
