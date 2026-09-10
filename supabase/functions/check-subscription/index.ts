import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized, notFound } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { isSubscribed } from '../_shared/bot_api.ts';

interface CheckSubscriptionRequest {
  initData?: string;
  projectId?: number;
}

/**
 * «Проверить» на subscribe-задании: подписан ли человек на канал проекта.
 *
 * Права бота проверяются здесь ещё раз, а не только при создании задания: их
 * могли отобрать после. Без прав `getChatMember` возвращает `left` даже для
 * подписанного (06 Telegram-бот), и засчитывать по такому ответу — значит
 * молча отказывать людям, которые всё сделали.
 *
 * Начисляет всё равно `apply_task_completion`: повтор ловит ключ, а не проверка
 * перед вставкой, и реферальная доплата приезжает оттуда же, если это первое
 * задание приглашённого.
 */
serve('check-subscription', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<CheckSubscriptionRequest>();
  if (!body.initData) throw badRequest('initData обязателен');
  if (!Number.isInteger(body.projectId)) throw badRequest('projectId обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);
  const db = getAdminClient();

  const { data: project, error } = await db
    .from('projects')
    .select('id, tg_chat_id, tg_bot_is_admin, status')
    .eq('id', body.projectId)
    .maybeSingle();

  if (error) throw error;
  if (!project) throw notFound('Проект не найден');

  if (!project.tg_bot_is_admin || project.tg_chat_id === null) {
    throw badRequest('У этого проекта нет задания на подписку');
  }

  const subscribed = await isSubscribed(botToken, project.tg_chat_id, verified.user.id);
  if (!subscribed) {
    ctx.log('not subscribed', { userId, projectId: project.id });
    return { subscribed: false, granted: 0, referralGranted: 0 };
  }

  const { data, error: grantError } = await db.rpc('apply_task_completion', {
    p_user_id: userId,
    p_task_type: 'subscribe',
    p_project_id: project.id,
  });
  if (grantError) throw grantError;

  const result = Array.isArray(data) ? data[0] : data;
  const granted = Number(result?.granted ?? 0);
  const referralGranted = Number(result?.referral_granted ?? 0);

  ctx.log('subscription counted', { userId, projectId: project.id, granted, referralGranted });

  // balanceAfter приходит из хранимки, которая его и изменила. Складывать
  // `granted` с балансом, который держит экран, запрещает комментарий у самой
  // `applyVoteBalance`, и он прав дважды: тот баланс может отставать от голоса,
  // отданного на другой вкладке, а доплаты за приглашённого в `granted` нет.
  return {
    subscribed: true,
    granted,
    referralGranted,
    balanceAfter: Number(result?.balance_after ?? 0),
  };
});
