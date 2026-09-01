import {
  getSupabase,
  functionErrorMessage,
  isPaymentOutcomeUnknown,
  PaymentOutcomeUnknownError,
  type PaymentResult,
} from '@/shared/api';
import type { AttackQuote, AttackQuoteParams, CreateAttackParams } from './types';

/**
 * Числа для шторки атаки. Отдельный запрос, а не чтение из витрины: счётчики
 * атак лежат в `stake_transactions`, у которой нет политики на чтение, а
 * сессии Supabase у мини-аппа нет — личность живёт в `initData`.
 */
export async function fetchAttackQuote(params: AttackQuoteParams): Promise<AttackQuote> {
  const { data, error } = await getSupabase().functions.invoke<AttackQuote>('attack-quote', {
    method: 'POST',
    body: params,
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось рассчитать атаку'));
  if (!data) throw new Error('attack-quote ответил пусто');
  return data;
}

/**
 * Начать оплату атаки. Свою запись сервер находит сам по подписанному
 * `initData` — передавать её нельзя, иначе можно было бы бить, начисляя очки
 * чужому проекту.
 */
export async function createAttackPayment(params: CreateAttackParams): Promise<PaymentResult> {
  const { data, error } = await getSupabase().functions.invoke<PaymentResult>('create-payment', {
    method: 'POST',
    body: params,
  });
  if (error) {
    const message = await functionErrorMessage(error, 'Не удалось начать оплату');
    if (isPaymentOutcomeUnknown(error)) throw new PaymentOutcomeUnknownError(message);
    throw new Error(message);
  }
  if (!data) throw new Error('create-payment ответил пусто');
  return data;
}

/**
 * Сколько из суммы долетит до своей ставки после хейрката.
 *
 * Зеркало `creditedPoints` из supabase/functions/_shared/attack.ts, и таким
 * обязано остаться: предпросмотр в шторке и расчёт в `apply_payment` считают
 * одно и то же число, а разойдясь на единицу, покажут человеку не тот итог,
 * который он получит. Отсюда же BigInt вместо `landed * bp / 10000` — на
 * больших ставках произведение выходит за пределы точных целых в double.
 */
export function creditedFromBp(landed: number, coefficientBp: number): number {
  return Number((BigInt(landed) * BigInt(coefficientBp)) / 10000n);
}
