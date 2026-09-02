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
  /**
   * Чистое движение ставки за скользящие сутки — только у строк суточного
   * борда (вьюха `paid_today_top`). У обычной витрины его нет: там карточка
   * показывает саму ставку, а не её изменение.
   */
  todayAmount?: number;
}

/**
 * Что случилось с карточкой за скользящие сутки — обе стрелки дизайн-кита.
 *
 * `rank`/`categoryRank` — позиция суточной давности; какую из них вычитать из
 * текущей, решает открытый разрез: при фильтре по категории на карточке стоит
 * позиция 1..N этой категории.
 *
 * `amountDelta` — изменение ставки со знаком: полученная атака делает его
 * отрицательным, свой Raise и чужой донат — положительным.
 */
export interface Movement24h {
  rank: number;
  categoryRank: number;
  amountDelta: number;
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
