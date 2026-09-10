import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest } from '../_shared/http.ts';
import { verifyWebhookSecret } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { botIdFromToken } from '../_shared/bot_api.ts';
import type { TelegramUser } from '../_shared/telegram.ts';

interface TelegramUpdate {
  message?: {
    text?: string;
    from?: TelegramUser;
  };
  /** Права бота в канале изменились — Telegram присылает это сам. */
  my_chat_member?: {
    chat: { id: number; type?: string; username?: string; title?: string };
    new_chat_member?: { user?: { id?: number }; status?: string };
  };
  // pre_checkout_query и successful_payment добавляются в Срезе 1.10, когда
  // до них дойдёт очередь.
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

  // Права бота в канале сменились. Ждать, пока владелец нажмёт «Проверить»,
  // здесь нельзя: снятие прав — это ровно тот случай, когда задание надо
  // убрать немедленно, а владелец как раз ничего проверять не пойдёт.
  const membership = update.my_chat_member;
  if (membership) {
    const botId = botIdFromToken(Deno.env.get('BOT_TOKEN') ?? '');
    const changed = membership.new_chat_member;

    if (botId !== null && changed?.user?.id === botId) {
      const isAdmin = changed.status === 'administrator' || changed.status === 'creator';
      const { data, error } = await getAdminClient().rpc('apply_channel_admin', {
        p_chat_id: membership.chat.id,
        p_username: membership.chat.username ?? null,
        p_is_admin: isAdmin,
      });

      // Апдейт всё равно подтверждается: Telegram ретраит любой не-2xx, а
      // повтор здесь ничего не чинит — проект под этот чат просто не заведён.
      if (error) ctx.log('channel admin update failed', { chatId: membership.chat.id });
      else
        ctx.log('channel admin update', { chatId: membership.chat.id, isAdmin, projectId: data });
    }
  }

  return { ok: true };
});
