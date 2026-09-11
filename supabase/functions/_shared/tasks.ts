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
  /** Сколько человек пришло по ссылке — знаменатель прогресса рефералки. */
  invited: number;
  /** Активных платных проектов: больше них за сутки взять visit неоткуда. */
  paidProjects: number;
  /**
   * Предел переходов в сутки (`app_config.task_limits.visit_per_day`). Цель
   * задания — меньшее из него и числа проектов: обещать десять там, где их
   * пять, значит рисовать недостижимую полосу.
   */
  visitPerDay: number;
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
      return {
        ...base,
        // Пригласить можно ещё, сколько угодно — задание не закрывается никогда.
        state: 'available',
        // Никого ещё не пригласил — знаменателя нет, и полоса «0 из 0» сказала
        // бы о задании неправду. Разрыв между числами — это те, кто пришёл по
        // ссылке и не сделал ничего: за них награды нет (01 Механики).
        ...(ctx.invited > 0 ? { progress: { current: done.length, total: ctx.invited } } : {}),
      };
    }

    // subscribe: одна строка на канал, засчитывается навсегда.
    return { ...base, state: done.length > 0 ? 'done' : 'available' };
  });
}
