import { useEffect, useState } from 'react';
import {
  fetchProject,
  fetchProjectRank,
  type ProjectListItem,
  type ShowcaseType,
} from '@/entities/project';

export interface ProjectState {
  project: ProjectListItem | null;
  /** Считается отдельным запросом: без ранга страница всё равно осмысленна. */
  rank: number | null;
  status: 'loading' | 'ready' | 'error';
}

function metricOf(row: ProjectListItem): number {
  return row.type === 'paid' ? row.paidAmount : row.votes;
}

/**
 * Одна карточка со своим рангом. Сброс при смене id сделан сравнением в
 * рендере, а не setState в эффекте (react-hooks/set-state-in-effect): иначе
 * на переходе между проектами кадр показывал бы чужие данные.
 */
export function useProject(id: number, fallbackSegment: ShowcaseType): ProjectState {
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [status, setStatus] = useState<ProjectState['status']>('loading');

  const [loadedId, setLoadedId] = useState(id);
  if (loadedId !== id) {
    setLoadedId(id);
    setProject(null);
    setRank(null);
    setStatus('loading');
  }

  useEffect(() => {
    let cancelled = false;

    fetchProject(id)
      .then(async (row) => {
        if (cancelled) return;
        if (!row) {
          setStatus('error');
          return;
        }
        setProject(row);
        setStatus('ready');

        const position = await fetchProjectRank({
          type: row.type,
          projectId: row.id,
          metric: metricOf(row),
        }).catch(() => null);
        if (!cancelled) setRank(position);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id, fallbackSegment]);

  return { project, rank, status };
}
