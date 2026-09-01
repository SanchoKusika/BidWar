import { useEffect, useState } from 'react';
import {
  fetchMyProject,
  fetchProject,
  fetchProjectRank,
  type ProjectListItem,
  type ShowcaseType,
} from '@/entities/project';

export interface ProjectState {
  project: ProjectListItem | null;
  /** Считается отдельным запросом: без ранга страница всё равно осмысленна. */
  rank: number | null;
  /** Запись того же аккаунта в другом топе — блок «same account». */
  otherEntry: ProjectListItem | null;
  otherRank: number | null;
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
  const [other, setOther] = useState<{ entry: ProjectListItem | null; rank: number | null }>({
    entry: null,
    rank: null,
  });
  const [status, setStatus] = useState<ProjectState['status']>('loading');

  const [loadedId, setLoadedId] = useState(id);
  if (loadedId !== id) {
    setLoadedId(id);
    setProject(null);
    setRank(null);
    setOther({ entry: null, rank: null });
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

        // Запись того же ВЛАДЕЛЬЦА в противоположном топе — не смотрящего:
        // блок «same account» описывает открытый проект, и на чужой странице
        // он обязан показывать чужую пару, а не твою.
        //
        // fetchMyProject назван от лица смотрящего, но по сути это «активная
        // запись такого-то пользователя в таком-то топе» — их не больше одной
        // (projects_one_active_per_user_and_type_idx), поэтому годится как есть.
        const otherType: ShowcaseType = row.type === 'paid' ? 'free' : 'paid';
        const mate = await fetchMyProject(row.userId, otherType).catch(() => null);
        if (cancelled) return;
        if (!mate) {
          setOther({ entry: null, rank: null });
          return;
        }
        const matePosition = await fetchProjectRank({
          type: mate.type,
          projectId: mate.id,
          metric: metricOf(mate),
        }).catch(() => null);
        if (!cancelled) setOther({ entry: mate, rank: matePosition });
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id, fallbackSegment]);

  return { project, rank, otherEntry: other.entry, otherRank: other.rank, status };
}
