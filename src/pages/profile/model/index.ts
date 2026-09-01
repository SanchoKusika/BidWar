import { useOwnPosition, type ProjectListItem } from '@/entities/project';

export interface MyProject {
  project: ProjectListItem;
  /** Позиция в общем топе своей витрины, null — если посчитать не удалось. */
  rank: number | null;
}

export interface MyProjectsState {
  projects: MyProject[];
  loading: boolean;
  retry: () => void;
}

/**
 * Свои записи в обоих топах — по одной на топ, больше быть не может (уникальные
 * индексы projects_one_active_per_user_and_type_idx). Переиспользуем ту же
 * модель, что и панель «твоя позиция» на витринах: ранг считается на лету, а
 * не хранится, и разрез здесь всегда общий — в профиле нет фильтра по
 * категории, относительно которого его можно было бы сузить.
 *
 * Платная запись идёт первой: она стоит денег, и смотрят на неё чаще.
 */
export function useMyProjects(userId: string | null): MyProjectsState {
  const paid = useOwnPosition('paid', null, userId);
  const free = useOwnPosition('free', null, userId);

  const projects: MyProject[] = [];
  if (paid.project) projects.push({ project: paid.project, rank: paid.rank });
  if (free.project) projects.push({ project: free.project, rank: free.rank });

  return {
    projects,
    loading: paid.loading || free.loading,
    retry: () => {
      paid.retry();
      free.retry();
    },
  };
}
