import { getSupabase } from '@/shared/api';
import type { ShowcaseType } from '@/entities/project';
import type { CategoryStat } from './types';

/** Плитки категорий: пул, число проектов, лидер — отдельно для paid/free. */
export async function fetchCategoryStats(type: ShowcaseType): Promise<CategoryStat[]> {
  const { data, error } = await getSupabase()
    .from('category_stats')
    .select('category_id, slug, title, project_count, pool, leader_name')
    .eq('type', type)
    .order('category_id', { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const stats: CategoryStat[] = [];

  for (const row of rows) {
    if (row.category_id == null || row.slug == null || row.title == null) continue;
    stats.push({
      categoryId: row.category_id,
      slug: row.slug,
      title: row.title,
      type,
      projectCount: row.project_count ?? 0,
      pool: row.pool ?? 0,
      leaderName: row.leader_name,
    });
  }

  return stats;
}
