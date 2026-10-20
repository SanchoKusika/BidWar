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

/** A task's state for one account. `ready`: the condition is met, the reward waits for «Claim». */
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
  /** The project the task leads to: open it, subscribe, the newest newcomer. */
  targetProjectId: number | null;
  /** The task's link: the channel to subscribe to, the boost page. */
  targetUrl: string | null;
  state: TaskState;
  /** The goal and the way to it: friends, a ladder step, days of the streak. */
  progress?: { current: number; total: number };
  quest?: TaskQuest;
}
