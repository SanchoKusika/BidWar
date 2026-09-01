/**
 * Контракт запроса и ответа create-payment (задача 4 среза 1.5), см.
 * supabase/functions/create-payment/{index,validate}.ts и
 * supabase/functions/_shared/payments/types.ts. Ответ функции — это
 * CreatePaymentResult провайдера один в один: paymentId, status, openUrl,
 * projectId, pointsGranted.
 */

export interface CreatePaymentParams {
  initData: string;
  /** Сумма в очках: для UZS это и есть сумы (04 Платежи и валюты). */
  amount: number;
  /** Довзнос к своей ставке. Взаимоисключим с парой categoryId + url. */
  projectId?: number;
  /** Открывающий вход: категория и ссылка нового проекта. */
  categoryId?: number;
  url?: string;
}

export type { PaymentResult } from '@/shared/api';
