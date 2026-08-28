import type { ShowcaseType } from '@/entities/project';

export interface CategoryStat {
  categoryId: number;
  slug: string;
  title: string;
  type: ShowcaseType;
  /** Число активных проектов этого типа в категории. */
  projectCount: number;
  /** Сумма paid_amount (paid) или votes (free) по активным проектам. */
  pool: number;
  /** Имя лидера категории в этом типе, null если проектов нет. Для отображения. */
  leaderName: string | null;
  /** id лидера — им, а не именем, сверяется бейдж «#1 категории» на карточке. */
  leaderId: number | null;
}
