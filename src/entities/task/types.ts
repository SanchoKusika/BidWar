/**
 * Task types the board can carry. The server leaves out any type it does not
 * list (`_shared/tasks.ts`), and the client hides one it does not know, so a
 * new type rolls out without a blank card in an older build.
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

/**
 * Состояние задания для конкретного аккаунта. `ready` — условие выполнено,
 * награда ждёт нажатия «Забрать».
 */
export type TaskState = 'available' | 'ready' | 'pending' | 'done' | 'locked';

/** Section of the board: renews daily, a goal that steps up, or once. */
export type TaskGroup = 'daily' | 'goal' | 'once';

/** Today's quest of `daily_quest`, picked by the server. */
export type TaskQuest = 'backed' | 'categories';

export interface TaskItem {
  id: number;
  type: TaskType;
  /** Absent from a server older than the daily tasks. */
  group?: TaskGroup;
  title: string;
  description: string | null;
  /** What this step pays: a ladder's current goal, today's streak day. */
  rewardVotes: number;
  /** Проект, на который ведёт задание: зайти, подписаться, новичок витрины. */
  targetProjectId: number | null;
  /** Ссылка задания: канал подписки, буст канала. */
  targetUrl: string | null;
  state: TaskState;
  /** Цель и путь к ней: друзья, ступень лестницы, день серии. */
  progress?: { current: number; total: number };
  quest?: TaskQuest;
}
