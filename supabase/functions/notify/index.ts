import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifySecretHeader } from '../_shared/telegram.ts';
import { getAdminClient } from '../_shared/db.ts';
import { sendMessage } from '../_shared/bot_api.ts';
import { buttonText, localeFromCode, renderNotification } from '../_shared/notify_text.ts';

/** Строка очереди, уже склеенная и уже с адресом получателя. */
interface ClaimedRow {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  chat_id: string;
  language_code: string | null;
}

/** За один заход, чтобы не упереться в лимит Bot API (~30 сообщений в секунду). */
const BATCH = 25;

/**
 * Отправщик уведомлений. Будится расписанием базы (`cron.schedule` →
 * `drain_notifications()` → pg_net), поэтому Supabase-сессии у вызова нет и
 * `verify_jwt` выключен — подлинность доказывает общий секрет в заголовке, ровно
 * как у вебхука бота.
 *
 * Своей логики «кому и что» здесь нет: кому — решили триггеры на леджере, когда
 * событие случилось, что — решает словарь. Здесь только доставка и отметка о
 * ней.
 */
serve('notify', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const secret = Deno.env.get('NOTIFY_SECRET');
  if (!secret) throw new Error('NOTIFY_SECRET не задан в окружении функции');
  if (!verifySecretHeader(req, 'x-notify-secret', secret)) {
    throw unauthorized('Неверный секрет отправщика');
  }

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const appUrl = Deno.env.get('APP_URL') ?? 'https://app.bidwar.world/';
  const db = getAdminClient();

  const { data, error } = await db.rpc('claim_notifications', { p_limit: BATCH });
  if (error) throw error;

  const rows = (data ?? []) as ClaimedRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const locale = localeFromCode(row.language_code);
    const text = renderNotification({ kind: row.kind, payload: row.payload ?? {} }, locale);

    if (text === null) {
      // Вид, которого словарь не знает: пустое сообщение человеку не уходит,
      // строка остаётся с объяснением в last_error.
      await db.rpc('mark_notification_failed', {
        p_id: row.id,
        p_error: `unknown kind ${row.kind}`,
      });
      failed += 1;
      continue;
    }

    const result = await sendMessage(botToken, row.chat_id, text, {
      text: buttonText(locale),
      url: appUrl,
    });

    if (result.ok) {
      await db.rpc('mark_notification_sent', { p_id: row.id });
      sent += 1;
      continue;
    }

    failed += 1;
    if (result.permanent) {
      // Человек не начинал диалог с ботом или заблокировал его. Повтор ничего
      // не изменит, а пять попыток на каждое событие — это пять лишних вызовов
      // Bot API в минуту на одного и того же молчащего адресата.
      await db.rpc('drop_notification', {
        p_id: row.id,
        p_error: result.description ?? 'forbidden',
      });
    } else {
      await db.rpc('mark_notification_failed', {
        p_id: row.id,
        p_error: result.description ?? 'send failed',
      });
    }
  }

  ctx.log('drained', { claimed: rows.length, sent, failed });
  return { claimed: rows.length, sent, failed };
});
