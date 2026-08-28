import { getSupabase } from '@/shared/api';
import type { Tables } from '@/shared/api';
import type { ProjectCursor, ProjectListItem, ProjectPage, ShowcaseType } from './types';

const PAGE_SIZE = 20;

type Row = Pick<
  Tables<'projects'>,
  | 'id'
  | 'user_id'
  | 'category_id'
  | 'type'
  | 'name'
  | 'url'
  | 'og_image_url'
  | 'og_description'
  | 'paid_amount'
  | 'votes'
  | 'clicks'
  | 'rank1_since'
>;

function mapRow(row: Row): ProjectListItem {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    type: row.type as ShowcaseType,
    name: row.name,
    url: row.url,
    ogImageUrl: row.og_image_url,
    ogDescription: row.og_description,
    paidAmount: row.paid_amount,
    votes: row.votes,
    clicks: row.clicks,
    rank1Since: row.rank1_since,
  };
}

function metricColumn(type: ShowcaseType): 'paid_amount' | 'votes' {
  return type === 'paid' ? 'paid_amount' : 'votes';
}

export interface FetchProjectsParams {
  type: ShowcaseType;
  /** null/undefined — общий топ без фильтра по категории. */
  categoryId?: number | null;
  cursor?: ProjectCursor | null;
}

/**
 * Витрина, отсортированная по метрике своей экономики с тай-брейком по id
 * (см. 01 Механики.md — без него курсорная пагинация дублирует/пропускает
 * строки при равных значениях). Курсор — кейсет, не offset: страница
 * остаётся стабильной, даже если в топ выше нас что-то поменялось.
 */
export async function fetchProjects({
  type,
  categoryId,
  cursor,
}: FetchProjectsParams): Promise<ProjectPage> {
  const column = metricColumn(type);

  let query = getSupabase()
    .from('projects')
    .select(
      'id, user_id, category_id, type, name, url, og_image_url, og_description, paid_amount, votes, clicks, rank1_since',
    )
    .eq('type', type)
    .eq('status', 'active')
    .order(column, { ascending: false })
    .order('id', { ascending: true })
    .limit(PAGE_SIZE);

  if (categoryId != null) query = query.eq('category_id', categoryId);

  if (cursor) {
    query = query.or(
      `${column}.lt.${cursor.metric},and(${column}.eq.${cursor.metric},id.gt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = (data ?? []).map(mapRow);
  const last = items.at(-1);
  const nextCursor: ProjectCursor | null =
    items.length === PAGE_SIZE && last
      ? { metric: last.type === 'paid' ? last.paidAmount : last.votes, id: last.id }
      : null;

  return { items, nextCursor };
}

/** Своя активная запись в этой витрине, если есть — их не больше одной на тип. */
export async function fetchMyProject(
  userId: string,
  type: ShowcaseType,
): Promise<ProjectListItem | null> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select(
      'id, user_id, category_id, type, name, url, og_image_url, og_description, paid_amount, votes, clicks, rank1_since',
    )
    .eq('user_id', userId)
    .eq('type', type)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

export interface FetchProjectRankParams {
  projectId: number;
  type: ShowcaseType;
  metric: number;
  categoryId?: number | null;
}

/**
 * Позиция проекта в своей витрине, посчитанная на лету — как и сама витрина,
 * позиция нигде не хранится (01 Механики.md). Считает через PostgREST-count,
 * отдельный RPC под это не заводим: чтение витрин и так идёт напрямую.
 */
export async function fetchProjectRank({
  projectId,
  type,
  metric,
  categoryId,
}: FetchProjectRankParams): Promise<number> {
  if (!Number.isInteger(projectId) || !Number.isFinite(metric)) {
    throw new Error('fetchProjectRank: projectId/metric должны быть числами');
  }

  const column = metricColumn(type);

  let query = getSupabase()
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('type', type)
    .eq('status', 'active')
    .or(`${column}.gt.${metric},and(${column}.eq.${metric},id.lt.${projectId})`);

  if (categoryId != null) query = query.eq('category_id', categoryId);

  const { count, error } = await query;
  if (error) throw error;

  return (count ?? 0) + 1;
}
