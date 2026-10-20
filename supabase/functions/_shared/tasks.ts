/**
 * Состояние заданий под конкретного человека.
 *
 * Отдельно от `tasks/index.ts` по той же причине, по какой отдельно живёт
 * `attack_quote.ts`: здесь чистая функция от уже прочитанных строк, и её можно
 * гонять быстрыми тестами без базы и без сети. Ходы в базу остаются в функции.
 */

export type TaskType =
  | 'visit'
  | 'subscribe'
  | 'referral'
  | 'daily_checkin'
  | 'daily_votes'
  | 'daily_visits'
  | 'daily_scout'
  | 'daily_quest'
  | 'ladder_streak'
  | 'ladder_votes'
  | 'ladder_backed'
  | 'ladder_visits'
  | 'ladder_subscriptions'
  | 'referral_streak'
  | 'add_project'
  | 'bot_dm'
  | 'boost'
  | 'site_login'
  | 'premium';

/** `ready` — the condition is met and the reward waits for a tap. */
export type TaskState = 'available' | 'ready' | 'pending' | 'done' | 'locked';

/** Section of the board: renews daily, a goal that steps up, or once. */
export type TaskGroup = 'daily' | 'goal' | 'once';

/** Today's quest of `daily_quest` (task_progress in SQL picks it). */
export type TaskQuest = 'backed' | 'categories';

/**
 * Board order and section, by type. Order is fixed rather than by id: the
 * daily bonus was added last and still belongs at the top of the day.
 */
const LAYOUT: readonly (readonly [TaskType, TaskGroup])[] = [
  ['daily_checkin', 'daily'],
  ['visit', 'daily'],
  ['daily_visits', 'daily'],
  ['daily_scout', 'daily'],
  ['daily_votes', 'daily'],
  ['daily_quest', 'daily'],
  ['referral', 'goal'],
  ['referral_streak', 'goal'],
  ['ladder_streak', 'goal'],
  ['ladder_votes', 'goal'],
  ['ladder_backed', 'goal'],
  ['ladder_visits', 'goal'],
  ['ladder_subscriptions', 'goal'],
  ['subscribe', 'once'],
  ['bot_dm', 'once'],
  ['add_project', 'once'],
  ['site_login', 'once'],
  ['boost', 'once'],
  ['premium', 'once'],
];

const GROUP = new Map<string, TaskGroup>(LAYOUT);
const ORDER = new Map<string, number>(LAYOUT.map(([type], index) => [type, index]));

/** The three types whose state is still counted here rather than in SQL. */
const LEGACY = new Set<string>(['visit', 'subscribe', 'referral']);

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

/**
 * One row of `task_progress` — where a newer task stands, computed in the
 * database because the claim reads the very same function (a card saying
 * «claim» and a claim saying «not yet» cannot disagree).
 */
export interface ProgressRow {
  task_id: number;
  state: string;
  current_value: number | null;
  goal: number | null;
  reward: number;
  target_project_id: number | null;
  quest: string | null;
}

export interface TaskPayload {
  id: number;
  type: TaskType;
  group: TaskGroup;
  title: string;
  description: string | null;
  rewardVotes: number;
  targetProjectId: number | null;
  targetUrl: string | null;
  state: TaskState;
  progress?: { current: number; total: number };
  quest?: TaskQuest;
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
  progress: readonly ProgressRow[] = [],
): TaskPayload[] {
  const byTask = new Map(progress.map((row) => [Number(row.task_id), row]));

  return tasks
    .flatMap((task): TaskPayload[] => {
      const group = GROUP.get(task.type);
      // A type this build does not know is left out, not drawn as a blank card.
      if (!group) return [];
      if (LEGACY.has(task.type)) return [legacyItem(task, group, completions, ctx)];

      // Not returned by task_progress means hidden: nothing to reach right
      // now, or not for this person (a boost without Premium).
      const row = byTask.get(task.id);
      return row ? [progressItem(task, group, row)] : [];
    })
    .sort((a, b) => (ORDER.get(a.type) ?? 0) - (ORDER.get(b.type) ?? 0) || a.id - b.id);
}

function baseOf(task: TaskRow, group: TaskGroup) {
  return {
    id: task.id,
    type: task.type as TaskType,
    group,
    title: task.title,
    description: task.description,
    rewardVotes: Number(task.reward_votes),
    targetProjectId: task.target_project_id,
    targetUrl: task.target_url ?? null,
  };
}

const STATES: readonly TaskState[] = ['available', 'ready', 'pending', 'done', 'locked'];

function progressItem(task: TaskRow, group: TaskGroup, row: ProgressRow): TaskPayload {
  const state = STATES.includes(row.state as TaskState) ? (row.state as TaskState) : 'available';
  const item: TaskPayload = {
    ...baseOf(task, group),
    // The reward of THIS step or streak day, not the row's first one.
    rewardVotes: Number(row.reward),
    targetProjectId: row.target_project_id ?? task.target_project_id,
    state,
  };
  if (row.goal !== null && row.current_value !== null) {
    item.progress = { current: Number(row.current_value), total: Number(row.goal) };
  }
  if (row.quest === 'backed' || row.quest === 'categories') item.quest = row.quest;
  return item;
}

function legacyItem(
  task: TaskRow,
  group: TaskGroup,
  completions: readonly CompletionRow[],
  ctx: BoardContext,
): TaskPayload {
  const done = completions.filter((row) => row.task_id === task.id);
  const base = baseOf(task, group);

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
}
