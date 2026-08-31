import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest } from '../_shared/http.ts';
import { getProvider } from '../_shared/payments/registry.ts';
import { applyPayment } from '../_shared/payments/apply.ts';

/**
 * Точка входа вебхуков провайдера. В срезе 1.5 её не зовёт никто: мок
 * подтверждает платёж синхронно внутри create-payment. Она существует, чтобы
 * применение эффекта было ровно в одном месте, когда в срезе 1.10 придёт
 * настоящий провайдер.
 *
 * Функция задеплоена с verify_jwt: false (внешний провайдер не несёт JWT
 * Supabase, как и Telegram в функции bot) — значит, единственная проверка
 * подлинности запроса лежит внутри parseWebhook. Тело запроса нигде в этом
 * файле не разбирается напрямую: req целиком уходит в parseWebhook, и
 * applyPayment получает управление только если тот его принял и вернул
 * событие — до этого момента вызвать хранимку, двигающую деньги, неоткуда.
 */
serve('payment-webhook', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const event = await getProvider().parseWebhook(req);
  const result = await applyPayment(event.paymentId, event.eventId, event.status === 'confirmed');

  ctx.log('webhook applied', {
    paymentId: event.paymentId,
    eventId: event.eventId,
    applied: result.applied,
  });

  return { applied: result.applied };
});
