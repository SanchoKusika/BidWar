/**
 * Ответ `create-payment` — один на оба намерения, Raise и Attack (см.
 * supabase/functions/_shared/payments/types.ts). Живёт в shared/api, потому
 * что это контракт функции, а не деталь одной фичи.
 */
export interface PaymentResult {
  paymentId: string;
  status: 'confirmed' | 'pending' | 'failed';
  /** Чем открыть оплату у hosted-провайдера. У мока нечего открывать. */
  openUrl: string | null;
  projectId: number;
  /** Очки платежа: прибавка к своей ставке у Raise, урон цели у Attack. */
  pointsGranted: number;
  /** Что долетело до своей ставки; у Attack меньше на хейркат. */
  creditedPoints: number;
}
