import { applyPayment } from './apply.ts';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  WebhookEvent,
} from './types.ts';

/** Сценарии для тестов; в интерфейсе мини-аппа не используются. */
export type MockCommand = 'decline' | 'stuck_pending' | 'duplicate';

/**
 * Мок — не заглушка на время ожидания, а постоянная часть архитектуры: на нём
 * живут тесты и dev-окружение, гонять реальные платежи в CI никто не будет
 * (08 План разработки).
 *
 * Ссылки на оплату он не отдаёт: openInvoice требует настоящий provider_token,
 * которого до среза 1.10 нет. Эффект применяется прямо здесь, синхронно, и
 * фронт отличает случай по полю status, а не по имени провайдера.
 */
export function createMockProvider(command?: MockCommand): PaymentProvider {
  return {
    id: 'mock',
    mode: 'telegram_native',
    currency: 'UZS',

    async createPayment(
      input: CreatePaymentInput & { paymentId: string },
    ): Promise<CreatePaymentResult> {
      const eventId = `mock-${input.paymentId}`;

      if (command === 'stuck_pending') {
        return {
          paymentId: input.paymentId,
          status: 'pending',
          openUrl: null,
          projectId: input.projectId,
          pointsGranted: 0,
        };
      }

      const confirmed = command !== 'decline';
      const first = await applyPayment(input.paymentId, eventId, confirmed);
      // Повторный вебхук: второй вызов обязан оказаться no-op.
      if (command === 'duplicate') await applyPayment(input.paymentId, eventId, confirmed);

      return {
        paymentId: input.paymentId,
        status: confirmed ? 'confirmed' : 'failed',
        openUrl: null,
        projectId: first.projectId,
        pointsGranted: first.pointsGranted,
      };
    },

    parseWebhook(): Promise<WebhookEvent> {
      // У мока нет внешней стороны: подтверждение приходит синхронно выше.
      return Promise.reject(new Error('MockPaymentProvider не принимает вебхуков'));
    },
  };
}
