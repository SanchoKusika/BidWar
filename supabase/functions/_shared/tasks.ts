/**
 * Состояние заданий под конкретного человека.
 *
 * Отдельно от `tasks/index.ts` по той же причине, по какой отдельно живёт
 * `attack_quote.ts`: здесь чистая функция от уже прочитанных строк, и её можно
 * гонять быстрыми тестами без базы и без сети. Ходы в базу остаются в функции.
 */

export type TaskType = 'visit' | 'subscribe' | 'referral';
export type TaskState = 'available' | 'pending' | 'done' | 'locked';

export interface TaskRow {
  id: number;
  type: string;
  title: string;
  description: string | null;
  reward_votes: number;
  target_project_id: number | null;
  /** Ссылка целевого проекта — по ней открывается канал у subscribe. */
  target_url?: string | null;
}

/** Выполненное задание — ровно те поля, по которым считается состояние. */
export interface CompletionRow {
  task_id: number;
  period_day: string | null;
}

export interface TaskPayload {
  id: number;
  type: TaskType;
  title: string;
  description: string | null;
  rewardVotes: number;
  targetProjectId: number | null;
  targetUrl: string | null;
  state: TaskState;
  progress?: { current: number; total: number };
}

export interface BoardContext {
  /** Сегодня в том же виде, в каком лежит `task_completions.period_day`. */
  today: string;
  /** Активных платных проектов: больше них за сутки взять visit неоткуда. */
  paidProjects: number;
  /**
   * Предел переходов в сутки (`app_config.task_limits.visit_per_day`). Цель
   * задания — меньшее из него и числа проектов: обещать десять там, где их
   * пять, значит рисовать недостижимую полосу.
   */
  visitPerDay: number;
  /**
   * Referral goals in friends who reached their first task
   * (`app_config.task_limits.referral_milestones`), ascending.
   */
  referralMilestones: readonly number[];
  /** Past the last milestone the goal keeps moving up by this much. */
  referralStep: number;
}

/**
 * The next referral goal above what is already reached: 1 → 3 → 5 → 10, then
 * +step for good. The task never closes — every friend still pays — so there
 * is always a next number to aim at instead of a finished «10 of 10».
 */
export function nextReferralGoal(
  reached: number,
  milestones: readonly number[],
  step: number,
): number {
  const next = milestones.find((goal) => goal > reached);
  if (next !== undefined) return next;
  const last = milestones.at(-1) ?? 0;
  const size = Math.max(1, step);
  return last + size * (Math.floor(Math.max(0, reached - last) / size) + 1);
}

export function buildTaskBoard(
  tasks: readonly TaskRow[],
  completions: readonly CompletionRow[],
  ctx: BoardContext,
): TaskPayload[] {
  return tasks.map((task) => {
    const done = completions.filter((row) => row.task_id === task.id);
    const base = {
      id: task.id,
      type: task.type as TaskType,
      title: task.title,
      description: task.description,
      rewardVotes: Number(task.reward_votes),
      targetProjectId: task.target_project_id,
      targetUrl: task.target_url ?? null,
    };

    if (task.type === 'visit') {
      // Сутки считаются по `period_day` самой строки, а не по времени её
      // создания: именно эта колонка и есть ключ дедупликации на сервере.
      const todayCount = done.filter((row) => row.period_day === ctx.today).length;
      const target = Math.min(ctx.visitPerDay, ctx.paidProjects);
      return {
        ...base,
        // «Выполнено» наступает на цели, а не на обходе всей витрины: до этого
        // среза цель равнялась числу платных проектов, и полоса «5 из 18»
        // читалась как задание, которое не закончить.
        state: target > 0 && todayCount >= target ? 'done' : 'available',
        progress: { current: Math.min(todayCount, target), total: target },
      };
    }

    if (task.type === 'referral') {
      // A friend counts once they finish their first task — that is when the
      // reward is paid (01 Механики), so the bar moves with the votes. The
      // goal steps up as each one is reached; `current` stays the true count,
      // the profile multiplies it by the reward.
      return {
        ...base,
        state: 'available',
        progress: {
          current: done.length,
          total: nextReferralGoal(done.length, ctx.referralMilestones, ctx.referralStep),
        },
      };
    }

    // subscribe: одна строка на канал, засчитывается навсегда.
    return { ...base, state: done.length > 0 ? 'done' : 'available' };
  });
}
