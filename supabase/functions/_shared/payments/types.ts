/**
 * Интерфейс платёжного провайдера из 04 Платежи и валюты. Бизнес-логика
 * Raise/Attack работает только с очками и paymentId — она не знает, что за
 * провайдер снаружи, и добавление настоящего не должно трогать её ни строкой.
 */

export type PaymentIntent = 'raise' | 'attack';

export type PaymentProviderId = 'mock' | 'globalpay' | 'platega' | 'paddle' | 'telegram_stars';

/** Как фронт открывает оплату: нативно внутри Telegram или редиректом. */
export type PaymentMode = 'telegram_native' | 'hosted';

export type PaymentStatus = 'confirmed' | 'pending' | 'failed';

export interface CreatePaymentInput {
  userId: string;
  intent: PaymentIntent;
  projectId: number;
  targetProjectId?: number;
  /** Сумма в валюте провайдера, целыми единицами. */
  amount: bigint;
}

export interface CreatePaymentResult {
  paymentId: string;
  status: PaymentStatus;
  /** Чем фронт откроет оплату. У мока нечего открывать — null. */
  openUrl: string | null;
  projectId: number;
  pointsGranted: number;
}

export interface WebhookEvent {
  /** Для идемпотентности. */
  eventId: string;
  paymentId: string;
  status: 'confirmed' | 'failed';
  originalAmount: bigint;
  originalCurrency: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly mode: PaymentMode;
  readonly currency: string;

  /**
   * Строку платежа создаёт вызывающая функция (нужен paymentId ещё до обращения
   * к провайдеру, чтобы писать вебхуки на уже существующую запись) — поэтому
   * provider получает его как часть входа, а не порождает сам.
   */
  createPayment(input: CreatePaymentInput & { paymentId: string }): Promise<CreatePaymentResult>;
  parseWebhook(req: Request): Promise<WebhookEvent>;
}
