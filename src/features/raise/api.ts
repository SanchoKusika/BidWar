import {
  getSupabase,
  functionErrorMessage,
  isPaymentOutcomeUnknown,
  PaymentOutcomeUnknownError,
} from '@/shared/api';
import type { CreatePaymentParams, PaymentResult } from './types';

/**
 * Начать платёж за позицию. Правила — минимум ставки, принадлежность проекта,
 * занятость слота — проверяет сервер: клиент их не дублирует, расхождение
 * здесь стоило бы денег.
 */
export async function createRaisePayment(params: CreatePaymentParams): Promise<PaymentResult> {
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
