/** Типы заданий из app_config.task_rewards — других схема не знает. */
export type TaskType = 'visit' | 'subscribe' | 'referral';

/** Состояние задания для конкретного аккаунта (task_completions.status). */
export type TaskState = 'available' | 'pending' | 'done' | 'locked';

export interface TaskItem {
  id: number;
  type: TaskType;
  title: string;
  description: string | null;
  rewardVotes: number;
  /** Проект, на который ведёт задание: зайти, подписаться. */
  targetProjectId: number | null;
  state: TaskState;
  /** Многошаговые задания — приглашения друзей. */
  progress?: { current: number; total: number };
}
