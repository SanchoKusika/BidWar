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

  const [tasks, user, completions, paidCount, limits] = await Promise.all([
    db
      .from('tasks')
      .select('id, type, title, description, reward_votes, target_project_id, target_url')
      .eq('is_active', true)
      .order('id'),
    db.from('users').select('vote_balance').eq('id', userId).single(),
    db
      .from('task_completions')
      .select('task_id, period_day')
      .eq('user_id', userId)
      .eq('status', 'completed'),
    // Own projects are left out: a click on them does not count
    // (register_project_click), so with them in the goal an owner of a paid
    // project could never finish the day — "4 of 5" forever.
    db
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'paid')
      .eq('status', 'active')
      .neq('user_id', userId),
    // Предел переходов — продуктовое число, и живёт там же, где награды.
    db.from('app_config').select('value').eq('key', 'task_limits').maybeSingle(),
  ]);

  for (const result of [tasks, user, completions, paidCount, limits]) {
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

  // Своя ссылка у задания площадки, ссылка проекта — у задания проекта.
  const rows = (tasks.data ?? []).map((task) => ({
    ...task,
    target_url:
      task.target_project_id === null
        ? (task.target_url ?? null)
        : (urls.get(task.target_project_id) ?? null),
  }));

  const taskLimits = (limits.data?.value ?? {}) as {
    visit_per_day?: number;
    referral_milestones?: number[];
    referral_milestone_step?: number;
  };

  const payload = buildTaskBoard(rows, completions.data ?? [], {
    // Дата в том же виде, в каком её пишет `current_date` на сервере базы.
    today: new Date().toISOString().slice(0, 10),
    paidProjects: paidCount.count ?? 0,
    visitPerDay: Number(taskLimits.visit_per_day ?? 10),
    // Falls back to the same goals the migration seeds: a missing key should
    // still give a ladder, not a single goal of one friend forever.
    referralMilestones: (taskLimits.referral_milestones ?? [1, 3, 5, 10])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b),
    referralStep: Number(taskLimits.referral_milestone_step ?? 10),
  });

  ctx.log('tasks listed', { userId, count: payload.length });

  return { voteBalance: Number(user.data?.vote_balance ?? 0), tasks: payload };
});
