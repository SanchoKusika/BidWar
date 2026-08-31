import { getSupabase, functionErrorMessage, isPaymentOutcomeUnknown } from '@/shared/api';
import type { CreatePaymentParams, PaymentResult } from './types';

/**
 * Соединение оборвалось до ответа create-payment — неизвестно, успел ли
 * сервер применить платёж (находка I6 финального ревью). Отдельный класс, а
 * не просто текст сообщения: вызывающий код (`PaidMobile.pay`) обязан
 * показать другую формулировку, а не «ничего не списано», и делать это по
 * `instanceof`, а не по совпадению строки.
 */
export class PaymentOutcomeUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentOutcomeUnknownError';
  }
}

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
