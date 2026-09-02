import { useCallback } from 'react';
import { useQuery } from '@/shared/lib/query';
import { fetchProjectActivity, fetchRecentActivity } from './api';
import type { StakeEvent } from './types';

const EMPTY: StakeEvent[] = [];

/**
 * Лента событий платного топа. У бесплатного своих событий пока нет вовсе —
 * `vote_transactions` пустая до среза 1.7, — и лента там просто не рисуется:
 * пустой блок честнее выдуманного.
 */
export interface ActivityState {
  events: StakeEvent[];
  retry: () => void;
}

export function useRecentActivity(enabled: boolean): ActivityState {
  const fetcher = useCallback(() => fetchRecentActivity(), []);
  const query = useQuery<StakeEvent[]>(enabled ? 'activity:paid' : null, fetcher);
  return { events: query.data ?? EMPTY, retry: query.refresh };
}

/** История ставки одного проекта. */
export function useProjectActivity(projectId: number | null): StakeEvent[] {
  const fetcher = useCallback(
    () => (projectId === null ? Promise.resolve(EMPTY) : fetchProjectActivity(projectId)),
    [projectId],
  );
  const query = useQuery<StakeEvent[]>(
    projectId === null ? null : `activity:${projectId}`,
    fetcher,
  );
  return query.data ?? EMPTY;
}
