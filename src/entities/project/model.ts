import { useCallback, useState } from 'react';
import {
  fetchMyProject,
  fetchNeighborAbove,
  fetchProjectRank,
  fetchProjects,
  fetchTopProject,
} from './api';
import type { NeighborProject } from './api';
import { useQuery } from '@/shared/lib/query';
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

/** Страница витрины целиком — то, что кладётся в кэш под один ключ. */
interface ShowcasePage {
  items: ProjectListItem[];
  cursor: ProjectCursor | null;
}

const EMPTY_ITEMS: ProjectListItem[] = [];

/**
 * Загрузка/пагинация/фильтр витрины — общая логика для Paid и Free (см.
 * FSD-схему в 02 Архитектура.md: модель каждой страницы пишется один раз).
 * Paid и Free отличаются только фиксированным `type`, поэтому реализация
 * одна, а `pages/paid` и `pages/free` — тонкие обёртки над ней.
 *
 * Кэш и признак «нечего показать» живут в `useQuery`: возврат на вкладку и
 * повторный заход в уже открытую категорию рисуются сразу, свежий ответ
 * подменяет их в фоне.
 */
export function useShowcase(type: ShowcaseType): ShowcaseState {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const key = `showcase:${type}:${categoryId ?? 'all'}`;
  const fetcher = useCallback(
    (): Promise<ShowcasePage> =>
      fetchProjects({ type, categoryId }).then((page) => ({
        items: page.items,
        cursor: page.nextCursor,
      })),
    [type, categoryId],
  );

  const query = useQuery<ShowcasePage>(key, fetcher);
  const { data, mutate } = query;

  const loadMore = useCallback(() => {
    if (!data?.cursor || loadingMore) return;
    const cursor = data.cursor;

    setLoadingMore(true);
    fetchProjects({ type, categoryId, cursor })
      .then((page) => {
        // Ключ уже зафиксирован в mutate: если за время запроса сменился
        // фильтр, дозагруженная страница уйдёт мимо показанного списка, а не
        // подмешается в него.
        mutate({ items: [...data.items, ...page.items], cursor: page.nextCursor });
      })
      .catch(() => {
        // Оставляем список и курсор как есть — кнопка «Показать ещё» никуда
        // не девается, повторный тап и есть retry, терять уже загруженное незачем.
      })
      .finally(() => setLoadingMore(false));
  }, [type, categoryId, data, loadingMore, mutate]);

  return {
    items: data?.items ?? EMPTY_ITEMS,
    categoryId,
    loading: query.loading,
    loadingMore,
    hasMore: data?.cursor != null,
    error: query.error,
    setCategoryId,
    loadMore,
    retry: query.refresh,
  };
}

export interface OwnPositionState {
  /** Своя активная запись в этой витрине, null — если её ещё нет. */
  project: ProjectListItem | null;
  /** Позиция в текущем разрезе (общем или по категории) — считается на лету. */
  rank: number | null;
  /** Строка прямо над своей — «сколько нужно, чтобы обойти». */
  neighborAbove: NeighborProject | null;
  /** Показывать нечего — уместен скелетон. */
  loading: boolean;
  /** На экране прошлый ответ, свежий ещё в пути (см. useQuery). */
  refreshing: boolean;
  /** Пересчитать после события, которое меняет свою запись (например, Add Project). */
  retry: () => void;
}

interface OwnResult {
  project: ProjectListItem | null;
  rank: number | null;
  neighborAbove: NeighborProject | null;
}

const EMPTY_OWN: OwnResult = { project: null, rank: null, neighborAbove: null };

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
  const key = userId ? `own:${type}:${categoryId ?? 'all'}:${userId}` : null;

  const fetcher = useCallback(async (): Promise<OwnResult> => {
    if (!userId) return EMPTY_OWN;
    const mine = await fetchMyProject(userId, type);
    if (!mine) return EMPTY_OWN;

    const metric = type === 'paid' ? mine.paidAmount : mine.votes;
    // Разрез фильтра применяем, только если он и есть категория своего
    // проекта — иначе «твоя позиция» считалась бы среди чужой категории,
    // в которой проект вообще не участвует (см. код-ревью PR #9).
    const scopeCategoryId = categoryId === mine.categoryId ? categoryId : null;
    const rankArgs = { projectId: mine.id, type, metric, categoryId: scopeCategoryId };
    // Отдельный catch на каждый запрос: сеть моргнула на одном из двух —
    // не теряем то, что успешно пришло по другому (rank и neighborAbove
    // независимы, обнулять оба из-за отказа одного не за что).
    const [rank, neighborAbove] = await Promise.all([
      fetchProjectRank(rankArgs).catch(() => null),
      fetchNeighborAbove(rankArgs).catch(() => null),
    ]);
    return { project: mine, rank, neighborAbove };
  }, [type, categoryId, userId]);

  const query = useQuery<OwnResult>(key, fetcher);
  const result = query.data ?? EMPTY_OWN;

  return {
    project: result.project,
    rank: result.rank,
    neighborAbove: result.neighborAbove,
    loading: query.loading,
    refreshing: query.refreshing,
    retry: query.refresh,
  };
}

/** Имя глобального лидера — для плитки «All» (не зависит от текущего фильтра). */
export interface TopProjectState {
  name: string | null;
  /** Пересчитать после события, которое может сменить глобального лидера. */
  retry: () => void;
}

export function useTopProject(type: ShowcaseType): TopProjectState {
  const fetcher = useCallback(
    () =>
      fetchTopProject(type)
        .then((top) => top?.name ?? null)
        // Имя лидера на плитке «All» — украшение, не критичный путь.
        .catch(() => null),
    [type],
  );

  const query = useQuery<string | null>(`top:${type}`, fetcher);
  return { name: query.data ?? null, retry: query.refresh };
}
