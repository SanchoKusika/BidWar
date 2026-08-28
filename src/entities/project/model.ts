import { useCallback, useEffect, useState } from 'react';
import { fetchMyProject, fetchProjectRank, fetchProjects } from './api';
import type { ProjectCursor, ProjectListItem, ShowcaseType } from './types';

export interface ShowcaseState {
  items: ProjectListItem[];
  categoryId: number | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: boolean;
  setCategoryId: (id: number | null) => void;
  loadMore: () => void;
  retry: () => void;
}

interface ShowcaseResult {
  key: string;
  items: ProjectListItem[];
  cursor: ProjectCursor | null;
  error: boolean;
}

const EMPTY_RESULT: ShowcaseResult = { key: '', items: [], cursor: null, error: false };

function showcaseKey(type: ShowcaseType, categoryId: number | null, token: number): string {
  return `${type}:${categoryId ?? 'all'}:${token}`;
}

/**
 * Загрузка/пагинация/фильтр витрины — общая логика для Paid и Free (см.
 * FSD-схему в 02 Архитектура.md: модель каждой страницы пишется один раз).
 * Paid и Free отличаются только фиксированным `type`, поэтому реализация
 * одна, а `pages/paid` и `pages/free` — тонкие обёртки над ней.
 *
 * `loading` — не отдельный стейт, а сравнение ключа последнего пришедшего
 * результата с ключом текущих параметров: эффект не дёргает setState
 * синхронно при смене фильтра, а просто ждёт, пока результат не устареет.
 */
export function useShowcase(type: ShowcaseType): ShowcaseState {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [result, setResult] = useState<ShowcaseResult>(EMPTY_RESULT);

  const currentKey = showcaseKey(type, categoryId, reloadToken);
  const loading = result.key !== currentKey;

  useEffect(() => {
    let cancelled = false;
    const key = showcaseKey(type, categoryId, reloadToken);

    fetchProjects({ type, categoryId })
      .then((page) => {
        if (!cancelled)
          setResult({ key, items: page.items, cursor: page.nextCursor, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, items: [], cursor: null, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [type, categoryId, reloadToken]);

  const loadMore = useCallback(() => {
    if (!result.cursor || loadingMore) return;

    setLoadingMore(true);
    fetchProjects({ type, categoryId, cursor: result.cursor })
      .then((page) => {
        setResult((prev) => ({
          ...prev,
          items: [...prev.items, ...page.items],
          cursor: page.nextCursor,
        }));
      })
      .catch(() => setResult((prev) => ({ ...prev, error: true })))
      .finally(() => setLoadingMore(false));
  }, [type, categoryId, result.cursor, loadingMore]);

  return {
    items: result.items,
    categoryId,
    loading,
    loadingMore,
    hasMore: result.cursor !== null,
    error: result.error,
    setCategoryId,
    loadMore,
    retry: () => setReloadToken((n) => n + 1),
  };
}

export interface OwnPositionState {
  /** Своя активная запись в этой витрине, null — если её ещё нет. */
  project: ProjectListItem | null;
  /** Позиция в текущем разрезе (общем или по категории) — считается на лету. */
  rank: number | null;
  loading: boolean;
}

interface OwnResult {
  key: string;
  project: ProjectListItem | null;
  rank: number | null;
}

const EMPTY_OWN: OwnResult = { key: '', project: null, rank: null };

function ownKey(type: ShowcaseType, categoryId: number | null, userId: string): string {
  return `${type}:${categoryId ?? 'all'}:${userId}`;
}

/**
 * Панель «твоя позиция» (07 Экраны.md). Позиция считается в том же разрезе,
 * что сейчас открыт в витрине — общем или по категории (01 Механики.md:
 * «позиция считается в обоих разрезах»).
 */
export function useOwnPosition(
  type: ShowcaseType,
  categoryId: number | null,
  userId: string | null,
): OwnPositionState {
  const [result, setResult] = useState<OwnResult>(EMPTY_OWN);

  const currentKey = userId ? ownKey(type, categoryId, userId) : null;
  const loading = currentKey !== null && result.key !== currentKey;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const key = ownKey(type, categoryId, userId);

    fetchMyProject(userId, type)
      .then((mine) => {
        if (cancelled) return undefined;
        if (!mine) {
          setResult({ key, project: null, rank: null });
          return undefined;
        }
        const metric = type === 'paid' ? mine.paidAmount : mine.votes;
        return fetchProjectRank({ projectId: mine.id, type, metric, categoryId }).then((rank) => {
          if (!cancelled) setResult({ key, project: mine, rank });
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, project: null, rank: null });
      });

    return () => {
      cancelled = true;
    };
  }, [type, categoryId, userId]);

  // Гость/сессия ещё не готова — не показываем данные предыдущего userId,
  // даже если result их ещё хранит (эффект тут ничего не чистит синхронно).
  return {
    project: userId ? result.project : null,
    rank: userId ? result.rank : null,
    loading,
  };
}
