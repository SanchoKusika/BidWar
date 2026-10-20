import { getSupabase, functionErrorMessage } from '@/shared/api';
import type { ClaimTaskParams, ClaimTaskResult } from './types';

/**
 * Claim a task the server can check: the daily bonus, a daily goal, a ladder
 * step, a one-time action. The server decides whether it is ready and what it
 * pays; the client only shows the answer.
 */
export async function claimTask(params: ClaimTaskParams): Promise<ClaimTaskResult> {
  const { data, error } = await getSupabase().functions.invoke<ClaimTaskResult>('claim-task', {
    method: 'POST',
    body: params,
  });

  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось забрать награду'));
  if (!data) throw new Error('claim-task ответил пусто');

  return data;
}
