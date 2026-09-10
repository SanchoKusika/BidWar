import { getSupabase, functionErrorMessage } from '@/shared/api';
import type { CheckSubscriptionParams, CheckSubscriptionResult } from './types';

/**
 * Проверить подписку и засчитать задание.
 *
 * Проверяет сервер, и только он: `getChatMember` доступен боту, а не
 * мини-аппу. Клиент не решает даже того, подписан ли человек, — он показывает
 * ответ.
 */
export async function checkSubscription(
  params: CheckSubscriptionParams,
): Promise<CheckSubscriptionResult> {
  const { data, error } = await getSupabase().functions.invoke<CheckSubscriptionResult>(
    'check-subscription',
    { method: 'POST', body: params },
  );

  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось проверить подписку'));
  if (!data) throw new Error('check-subscription ответил пусто');

  return data;
}
