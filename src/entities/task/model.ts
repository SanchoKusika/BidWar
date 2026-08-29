import type { IconName } from '@/shared/ui/Icon';
import type { TaskItem, TaskType } from './types';

export const TASK_ICON: Record<TaskType, IconName> = {
  visit: 'external-link',
  subscribe: 'send',
  referral: 'user-plus',
};

/**
 * Деление на «каждый день» и «один раз».
 *
 * В схеме признака периодичности нет вообще — есть только tasks.type. Заход в
 * проект повторяется, подписка и приглашение засчитываются один раз, поэтому
 * группа выводится из типа. Когда периодичность понадобится настраивать, это
 * должна быть колонка в tasks, а не догадка на клиенте.
 */
const DAILY: readonly TaskType[] = ['visit'];

export function isDaily(task: TaskItem): boolean {
  return DAILY.includes(task.type);
}

export function splitTasks(tasks: readonly TaskItem[]): {
  daily: TaskItem[];
  oneTime: TaskItem[];
} {
  return {
    daily: tasks.filter(isDaily),
    oneTime: tasks.filter((t) => !isDaily(t)),
  };
}
