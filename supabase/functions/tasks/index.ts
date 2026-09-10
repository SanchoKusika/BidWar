import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { buildTaskBoard } from '../_shared/tasks.ts';

interface TasksRequest {
  initData?: string;
}

/**
 * Список заданий с состоянием под конкретного человека и его баланс голосов.
 *
 * Через функцию, а не чтением с фронта под RLS: у `task_completions` нет
 * политики на чтение и не должно быть — там видно, кто что выполнил, — а
 * сессии Supabase у мини-аппа не существует вовсе (05 Аккаунты). Личность
 * живёт в `initData` и проверяется здесь. Та же причина, что у `my-spending`.
 *
 * Само состояние считает `_shared/tasks.ts` — чистой функцией от прочитанных
 * строк, чтобы её покрывали быстрые тесты без базы.
 */
serve('tasks', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<TasksRequest>();
  if (!body.initData) throw badRequest('initData обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);
  const db = getAdminClient();

  const [tasks, user, completions, invited, paidCount] = await Promise.all([
    db
      .from('tasks')
      .select('id, type, title, description, reward_votes, target_project_id')
      .eq('is_active', true)
      .order('id'),
    db.from('users').select('vote_balance').eq('id', userId).single(),
    db
      .from('task_completions')
      .select('task_id, period_day')
      .eq('user_id', userId)
      .eq('status', 'completed'),
    db.from('users').select('id', { count: 'exact', head: true }).eq('referrer_id', userId),
    db
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'paid')
      .eq('status', 'active'),
  ]);

  for (const result of [tasks, user, completions, invited, paidCount]) {
    if (result.error) throw result.error;
  }

  // Ссылки целевых проектов — только для subscribe: по ним экран открывает
  // канал, когда человек ещё не подписан. Отдельным запросом, а не встроенным
  // join'ом: строк с целью единицы, а имя связи во встроенном join придётся
  // держать в согласии со схемой (на этом уже спотыкались в `my-spending`).
  const targetIds = (tasks.data ?? [])
    .map((task) => task.target_project_id)
    .filter((id): id is number => id !== null);

  const urls = new Map<number, string>();
  if (targetIds.length > 0) {
    const { data: targets, error: targetsError } = await db
      .from('projects')
      .select('id, url')
      .in('id', targetIds);
    if (targetsError) throw targetsError;
    for (const row of targets ?? []) urls.set(row.id, row.url);
  }

  const rows = (tasks.data ?? []).map((task) => ({
    ...task,
    target_url: task.target_project_id === null ? null : (urls.get(task.target_project_id) ?? null),
  }));

  const payload = buildTaskBoard(rows, completions.data ?? [], {
    // Дата в том же виде, в каком её пишет `current_date` на сервере базы.
    today: new Date().toISOString().slice(0, 10),
    invited: invited.count ?? 0,
    paidProjects: paidCount.count ?? 0,
  });

  ctx.log('tasks listed', { userId, count: payload.length });

  return { voteBalance: Number(user.data?.vote_balance ?? 0), tasks: payload };
});
