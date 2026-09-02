import { getSupabase } from '@/shared/api';
import type { StakeEvent, StakeEventType } from './types';

/**
 * Колонки вьюхи приходят из генератора типов как nullable: планировщик не
 * доказывает NOT NULL сквозь представление, даже когда все источники
 * обязательные. Значит и разбор обязан быть терпимым — строку без id или
 * проекта отбрасываем, вместо того чтобы делать вид, что таких не бывает.
 */
type Row = {
  id: number | null;
  project_id: number | null;
  project_name: string | null;
  target_project_id: number | null;
  target_name: string | null;
  type: string | null;
  amount: number | null;
  created_at: string | null;
};

const COLUMNS =
  'id, project_id, project_name, target_project_id, target_name, type, amount, created_at';

function mapRows(rows: Row[]): StakeEvent[] {
  const events: StakeEvent[] = [];
  for (const row of rows) {
    if (row.id === null || row.project_id === null || row.created_at === null) continue;
    events.push({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name ?? '',
      targetProjectId: row.target_project_id,
      targetName: row.target_name,
      type: row.type as StakeEventType,
      amount: row.amount ?? 0,
      createdAt: row.created_at,
    });
  }
  return events;
}

/**
 * Общая лента «только что» платного топа.
 *
 * `attack_in` отсюда исключён намеренно: одна атака пишет в леджер две строки,
 * и в общей ленте вторая была бы тем же событием во второй раз. На странице
 * проекта она, наоборот, нужна — там это рост собственной ставки.
 */
export async function fetchRecentActivity(limit = 8): Promise<StakeEvent[]> {
  const { data, error } = await getSupabase()
    .from('stake_activity')
    .select(COLUMNS)
    .in('type', ['raise', 'attack_out'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return mapRows(data ?? []);
}

/** История ставки одного проекта — все три типа событий. */
export async function fetchProjectActivity(projectId: number, limit = 6): Promise<StakeEvent[]> {
  const { data, error } = await getSupabase()
    .from('stake_activity')
    .select(COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return mapRows(data ?? []);
}
