import { getSupabase, functionErrorMessage } from '@/shared/api';
import type { TaskItem } from './types';

export interface TaskBoard {
  /** Баланс на момент ответа — свежее, чем в сессии: она грузится один раз. */
  voteBalance: number;
  tasks: TaskItem[];
}

interface TaskBoardResponse {
  voteBalance: number;
  tasks: TaskItem[];
}

/**
 * Задания с состоянием под конкретного человека.
 *
 * Через функцию, а не чтением таблицы под RLS: у `task_completions` нет
 * политики на чтение — там видно, кто что выполнил, — а сессии Supabase у
 * мини-аппа нет вообще, значит и `auth.uid()`, на который политику можно было
 * бы написать, не существует. Та же причина, что у `my-spending`.
 */
export async function fetchTasks(initData: string): Promise<TaskBoard> {
  const { data, error } = await getSupabase().functions.invoke<TaskBoardResponse>('tasks', {
    method: 'POST',
    body: { initData },
  });

  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось загрузить задания'));
  if (!data) throw new Error('tasks ответил пусто');

  return { voteBalance: data.voteBalance, tasks: data.tasks };
}
