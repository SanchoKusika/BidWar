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
  state: TaskState;
  progress?: { current: number; total: number };
}

export interface BoardContext {
  /** Сегодня в том же виде, в каком лежит `task_completions.period_day`. */
  today: string;
  /** Сколько человек пришло по ссылке — знаменатель прогресса рефералки. */
  invited: number;
  /** Активных платных проектов: столько раз за сутки можно взять visit. */
  paidProjects: number;
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
    };

    if (task.type === 'visit') {
      // Сутки считаются по `period_day` самой строки, а не по времени её
      // создания: именно эта колонка и есть ключ дедупликации на сервере.
      const todayCount = done.filter((row) => row.period_day === ctx.today).length;
      return {
        ...base,
        // «Выполнено» у возобновляемого задания наступает, только когда за
        // сутки обойдены все проекты: каждый следующий платит снова.
        state: ctx.paidProjects > 0 && todayCount >= ctx.paidProjects ? 'done' : 'available',
        progress: { current: todayCount, total: ctx.paidProjects },
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
