import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest } from '../_shared/http.ts';
import { verifyWebhookSecret } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import type { TelegramUser } from '../_shared/telegram.ts';

interface TelegramUpdate {
  message?: {
    text?: string;
    from?: TelegramUser;
  };
  // pre_checkout_query, successful_payment, my_chat_member — добавляются
  // в Срезах 1.7 и 1.10, когда до них доходит очередь.
}

// `startsWith('/start')` ловил бы и "/startup ...". В группах Telegram шлёт
// `/start@BotName <payload>` — суффикс с юзернеймом бота тоже нужно отрезать.
const START_COMMAND_RE = /^\/start(?:@\w+)?(?:\s+(.+))?$/;

/**
 * Вебхук бота. Сейчас обрабатывает только `/start [referrer]` — регистрация
 * и приём реферального параметра. Остальные типы апдейтов Telegram всё равно
 * ждёт 200 в ответ, поэтому они молча подтверждаются и игнорируются.
 */
serve('bot', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || !verifyWebhookSecret(req, secret)) {
    // 200, а не 401: не-2xx Telegram трактует как недоставленный апдейт и
    // ретраит бесконечно, а тут это либо чужой вызов, либо наш же дрейф
    // конфигурации — ни то, ни другое не лечится ретраями.
    ctx.log('webhook secret mismatch');
    return { ok: true };
  }

  const update = await ctx.body<TelegramUpdate>();
  const message = update.message;
  const match = message?.text ? START_COMMAND_RE.exec(message.text) : null;

  if (message?.from && match) {
    const startParam = match[1]?.trim() || null;
    const result = await resolveTelegramUser(message.from, startParam);
    ctx.log('/start resolved', { userId: result.userId, isNew: result.isNew });
  }

  return { ok: true };
});
