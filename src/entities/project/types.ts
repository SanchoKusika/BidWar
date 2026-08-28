export type ShowcaseType = 'paid' | 'free';

export interface ProjectListItem {
  id: number;
  userId: string;
  categoryId: number;
  type: ShowcaseType;
  name: string;
  url: string;
  ogImageUrl: string | null;
  ogDescription: string | null;
  paidAmount: number;
  votes: number;
  clicks: number;
  rank1Since: string | null;
}

/** Курсор кейсет-пагинации: последняя увиденная (метрика, id) пара. */
export interface ProjectCursor {
  metric: number;
  id: number;
}

export interface ProjectPage {
  items: ProjectListItem[];
  nextCursor: ProjectCursor | null;
}
