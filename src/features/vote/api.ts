import { getSupabase, functionErrorMessage } from '@/shared/api';
import type { CastVotesParams, CastVotesResult } from './types';

/**
 * Отдать голоса проекту — своему или чужому, это разрешено (01 Механики).
 *
 * Отказ приходит обычной ошибкой функции с готовым текстом: причин ровно
 * четыре, все они «так нельзя», и разбирать их по коду на клиенте значит
 * держать вторую копию правил рядом с первой.
 */
export async function castVotes(params: CastVotesParams): Promise<CastVotesResult> {
  const { data, error } = await getSupabase().functions.invoke<CastVotesResult>('cast-votes', {
    method: 'POST',
    body: params,
  });

  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось отдать голоса'));
  if (!data) throw new Error('cast-votes ответил пусто');

  return data;
}
