import { getSupabase, functionErrorMessage } from '@/shared/api';
import type { Tables } from '@/shared/api';
import type {
  Movement24h,
  ProjectCursor,
  ProjectListItem,
  ProjectPage,
  ShowcaseType,
} from './types';

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

function metricFromRow(row: Pick<Row, 'type' | 'paid_amount' | 'votes'>): number {
  return row.type === 'paid' ? row.paid_amount : row.votes;
}

/**
 * Фильтр «строки, обгоняющие эту» — общий тай-брейк для ранга и соседа сверху
 * (01 Механики.md: ORDER BY metric DESC, id ASC). Один источник правды на обе
 * функции, а не два независимых `.or(...)`, которые легко рассинхронить.
 */
function aboveFilter(column: 'paid_amount' | 'votes', metric: number, projectId: number): string {
  return `${column}.gt.${metric},and(${column}.eq.${metric},id.lt.${projectId})`;
}

function assertRankArgs(fn: string, projectId: number, metric: number): void {
  if (!Number.isInteger(projectId) || !Number.isFinite(metric)) {
    throw new Error(`${fn}: projectId/metric должны быть числами`);
  }
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

/**
 * Платный топ за скользящие сутки — вкладка «Today» в шапке витрины.
 *
 * Сортировка по движению ставки за сутки, а не по самой ставке: вопрос этой
 * вкладки — «кто вырос сегодня». Отрицательные движения (проект получил
 * атаку) в список не попадают — строка «вырос на −40 000» была бы
 * бессмыслицей, а не честностью.
 *
 * Пагинации нет намеренно: за сутки движется десяток строк, а курсор по
 * агрегату потребовал бы второй, ни на что не похожей выборки.
 */
export async function fetchTodayBoard(categoryId?: number | null): Promise<ProjectListItem[]> {
  let query = getSupabase()
    .from('paid_today_top')
    .select(
      'id, user_id, category_id, type, name, url, og_image_url, og_description, paid_amount, votes, clicks, rank1_since, today_amount',
    )
    .gt('today_amount', 0)
    .order('today_amount', { ascending: false })
    .order('id', { ascending: true })
    .limit(50);

  if (categoryId != null) query = query.eq('category_id', categoryId);

  const { data, error } = await query;
  if (error) throw error;

  // Колонки вьюхи генератор типов помечает nullable — сквозь представление
  // планировщик NOT NULL не доказывает. Строки без id тут быть не может, но
  // разбирать её как обязательную значило бы соврать типом, а не проверить.
  const rows = data ?? [];
  const items: ProjectListItem[] = [];
  for (const row of rows) {
    if (row.id === null || row.type === null) continue;
    items.push({
      id: row.id,
      userId: row.user_id ?? '',
      categoryId: row.category_id ?? 0,
      type: row.type as ShowcaseType,
      name: row.name ?? '',
      url: row.url ?? '',
      ogImageUrl: row.og_image_url,
      ogDescription: row.og_description,
      paidAmount: row.paid_amount ?? 0,
      votes: row.votes ?? 0,
      clicks: row.clicks ?? 0,
      rank1Since: row.rank1_since,
      todayAmount: row.today_amount ?? 0,
    });
  }
  return items;
}

/**
 * Изменения платных карточек за скользящие сутки — обе стрелки: позиции и
 * ставки. Позиция считается на лету и здесь тоже: вьюха восстанавливает
 * прошлую ставку из леджера, снапшотов мы не держим (миграция
 * `20260902140000_movement_24h.sql`).
 *
 * Отдельный лёгкий запрос, а не колонка в выдаче витрины: витрина листается
 * курсором по `projects`, и join сюда заставил бы переписать пагинацию ради
 * украшения. Строк тут столько же, сколько платных проектов.
 *
 * Проекта, которого сутки назад не было, в ответе нет вовсе — «изменение»
 * требует того, что менялось, и стрелок у него не рисуется ни одной.
 */
export async function fetchMovement24h(): Promise<Map<number, Movement24h>> {
  const { data, error } = await getSupabase()
    .from('paid_movement_24h')
    .select('project_id, past_rank, past_category_rank, amount_delta')
    .limit(500);

  if (error) throw error;

  const map = new Map<number, Movement24h>();
  for (const row of data ?? []) {
    // Колонки вьюхи генератор типов помечает nullable — NOT NULL сквозь
    // представление планировщик не доказывает.
    if (row.project_id === null || row.past_rank === null) continue;
    map.set(row.project_id, {
      rank: Number(row.past_rank),
      categoryRank: Number(row.past_category_rank ?? row.past_rank),
      amountDelta: Number(row.amount_delta ?? 0),
    });
  }
  return map;
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

/** Одна карточка по id — для страницы проекта. */
export async function fetchProject(id: number): Promise<ProjectListItem | null> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select(
      'id, user_id, category_id, type, name, url, og_image_url, og_description, paid_amount, votes, clicks, rank1_since',
    )
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * Глобальный #1 витрины (без фильтра по категории) — нужен только как имя
 * лидера на плитке «All». Отдельный лёгкий запрос: список может быть открыт
 * с фильтром по категории, и тогда items[0] — не тот же самый проект.
 */
export async function fetchTopProject(type: ShowcaseType): Promise<{ name: string } | null> {
  const column = metricColumn(type);

  const { data, error } = await getSupabase()
    .from('projects')
    .select('name')
    .eq('type', type)
    .eq('status', 'active')
    .order(column, { ascending: false })
    .order('id', { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
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
  assertRankArgs('fetchProjectRank', projectId, metric);

  const column = metricColumn(type);

  let query = getSupabase()
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('type', type)
    .eq('status', 'active')
    .or(aboveFilter(column, metric, projectId));

  if (categoryId != null) query = query.eq('category_id', categoryId);

  const { count, error } = await query;
  if (error) throw error;

  return (count ?? 0) + 1;
}

export interface FetchNeighborAboveParams {
  projectId: number;
  type: ShowcaseType;
  metric: number;
  categoryId?: number | null;
}

export interface NeighborProject {
  name: string;
  metric: number;
}

/**
 * Строка прямо над проектом в его витрине — «сколько нужно, чтобы обойти
 * {имя} на #{ранг-1}» (07 Экраны.md, панель «твоя позиция»). Тот же
 * тай-брейк, что и у витрины: ближайшая обгоняющая строка — наименьшая
 * метрика среди тех, кто выше, а среди равных — с наибольшим id.
 */
export async function fetchNeighborAbove({
  projectId,
  type,
  metric,
  categoryId,
}: FetchNeighborAboveParams): Promise<NeighborProject | null> {
  assertRankArgs('fetchNeighborAbove', projectId, metric);

  const column = metricColumn(type);

  let query = getSupabase()
    .from('projects')
    .select('name, type, paid_amount, votes')
    .eq('type', type)
    .eq('status', 'active')
    .or(aboveFilter(column, metric, projectId))
    .order(column, { ascending: true })
    .order('id', { ascending: false })
    .limit(1);

  if (categoryId != null) query = query.eq('category_id', categoryId);

  const { data, error } = await query;
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;

  return { name: row.name, metric: metricFromRow(row) };
}

export interface CreateProjectParams {
  initData: string;
  categoryId: number;
  url: string;
}

/**
 * Только Free Top: платный вход — это открывающий Raise-платёж (Срез 1.5),
 * а не голая вставка строки. См. комментарий в supabase/functions/add-project.
 */
export async function createProject(params: CreateProjectParams): Promise<ProjectListItem> {
  const { data, error } = await getSupabase().functions.invoke<Row>('add-project', {
    method: 'POST',
    body: params,
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось добавить проект'));
  if (!data) throw new Error('add-project ответил пусто');
  return mapRow(data);
}

/**
 * Убрать свои записи из обоих топов. Строки не удаляются, а скрываются
 * (`status = 'hidden'`, 01 Механики) — на них ссылается леджер платежей.
 * Слот топа и адрес освобождаются: оба уникальных индекса смотрят только на
 * активные записи, так что тот же проект можно завести заново.
 */
export async function removeMyProjects(initData: string): Promise<number> {
  const { data, error } = await getSupabase().functions.invoke<{ removed: number }>(
    'remove-my-projects',
    { method: 'POST', body: { initData } },
  );
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось убрать проекты'));
  return data?.removed ?? 0;
}

export interface RegisterClickParams {
  initData: string;
  projectId: number;
}

/** true — клик засчитан впервые сегодня; false — уже кликал, счётчик не менялся. */
export async function registerClick(params: RegisterClickParams): Promise<boolean> {
  const { data, error } = await getSupabase().functions.invoke<{ counted: boolean }>('click', {
    method: 'POST',
    body: params,
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось засчитать клик'));
  return data?.counted ?? false;
}
