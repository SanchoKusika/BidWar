import { applyPayment, type ApplyResult } from './apply.ts';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  WebhookEvent,
} from './types.ts';

/** Сценарии для тестов; в интерфейсе мини-аппа не используются. */
export type MockCommand = 'decline' | 'stuck_pending' | 'duplicate';

/** Подпись хранимки — как параметр по умолчанию, так и заглушка в тестах. */
type ApplyFn = (paymentId: string, eventId: string, confirmed: boolean) => Promise<ApplyResult>;

/**
 * Мок — не заглушка на время ожидания, а постоянная часть архитектуры: на нём
 * живут тесты и dev-окружение, гонять реальные платежи в CI никто не будет
 * (08 План разработки).
 *
 * Ссылки на оплату он не отдаёт: openInvoice требует настоящий provider_token,
 * которого до среза 1.10 нет. Эффект применяется прямо здесь, синхронно, и
 * фронт отличает случай по полю status, а не по имени провайдера.
 *
 * `apply` — параметр, а не жёсткий вызов `applyPayment`, только ради теста
 * (`mock_test.ts`): `applyPayment` требует живую базу (`SUPABASE_URL` и
 * service role), а находка C1 финального ревью — баг в этой функции ДО
 * хранимки, его надо ловить без сети.
 */
export function createMockProvider(
  command?: MockCommand,
  apply: ApplyFn = applyPayment,
): PaymentProvider {
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
      const first = await apply(input.paymentId, eventId, confirmed);
      // Повторный вебхук: второй вызов обязан оказаться no-op.
      if (command === 'duplicate') await apply(input.paymentId, eventId, confirmed);

      // Находка C1 финального ревью: исход обязан выводиться из того, что
      // ВЕРНУЛА хранимка (applied), а не из намерения вызывающего (confirmed).
      // Если apply_payment отклонила платёж своей собственной причиной —
      // unique_violation на гонке за адрес/event_id, идемпотентный повтор —
      // applied будет false, даже когда мы честно просили confirmed = true.
      // Показать в этом случае status: 'confirmed' значило бы соврать
      // пользователю про списание, которого база не признала.
      return {
        paymentId: input.paymentId,
        status: first.applied ? 'confirmed' : 'failed',
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
