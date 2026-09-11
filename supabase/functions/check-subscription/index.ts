import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized, notFound, HttpError } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { botChatStatus, isSubscribed } from '../_shared/bot_api.ts';

interface CheckSubscriptionRequest {
  initData?: string;
  /** Задание, которое проверяем. Канал берётся из него, а не из тела запроса. */
  taskId?: number;
}

/**
 * «Проверить» на subscribe-задании: подписан ли человек на канал.
 *
 * Каналов два вида. У задания проекта чат лежит в `projects` вместе с признаком
 * прав бота — так задание и появляется, когда владелец добавил бота админом. У
 * задания площадки (наш собственный канал) чат лежит прямо в строке задания:
 * проекта за ним нет и быть не должно, иначе площадка окажется участником
 * собственного списка.
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
  if (!Number.isInteger(body.taskId)) throw badRequest('taskId обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);
  const db = getAdminClient();

  const { data: task, error } = await db
    .from('tasks')
    .select('id, type, is_active, target_project_id, target_chat_id')
    .eq('id', body.taskId)
    .maybeSingle();

  if (error) throw error;
  if (!task || task.type !== 'subscribe' || !task.is_active) {
    throw notFound('Задание не найдено');
  }

  const chatId = await resolveChat(db, task, botToken);
  if (chatId === null) throw badRequest('У этого задания нет канала для проверки');

  const subscribed = await isSubscribed(botToken, chatId, verified.user.id);
  if (!subscribed) {
    ctx.log('not subscribed', { userId, taskId: task.id });
    return { subscribed: false, granted: 0, referralGranted: 0 };
  }

  const { data, error: grantError } = await db.rpc('apply_task_completion', {
    p_user_id: userId,
    p_task_type: 'subscribe',
    // Задание площадки проектом не привязано: null здесь выбирает в хранимке
    // именно его строку — у заданий проекта `target_project_id` заполнен.
    p_project_id: task.target_project_id,
    // Id проверенного задания: без него хранимка выбирает строку заново по
    // типу и проекту — и с появлением задания площадки это стало значить
    // «засчитаю подписку на наш канал, если строка проекта успела погаснуть».
    p_task_id: task.id,
  });
  if (grantError) throw grantError;

  const result = Array.isArray(data) ? data[0] : data;
  const granted = Number(result?.granted ?? 0);
  const referralGranted = Number(result?.referral_granted ?? 0);

  ctx.log('subscription counted', { userId, taskId: task.id, granted, referralGranted });

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

type TaskRow = {
  target_project_id: number | null;
  target_chat_id: number | null;
};

/**
 * Чат задания и живые права бота в нём.
 *
 * У задания площадки признака прав в схеме нет — вместо него спрашиваем сам
 * Bot API: строка живёт постоянно, а права могли отобрать в любой момент, и
 * тогда `getChatMember` соврёт «не подписан» про подписанного.
 *
 * Три ответа, а не два: «не ответил» — это не «прав нет». Сетевая икота Telegram
 * не должна выглядеть для подписанного человека как «у задания нет канала»;
 * такой отказ ещё и не открывает канал, то есть не оставляет никакого выхода.
 */
async function resolveChat(
  db: ReturnType<typeof getAdminClient>,
  task: TaskRow,
  botToken: string,
): Promise<number | null> {
  if (task.target_project_id === null) {
    if (task.target_chat_id === null) return null;

    const status = await botChatStatus(botToken, task.target_chat_id);
    if (status === 'unknown') {
      throw new HttpError(503, 'upstream_unavailable', 'Telegram не ответил — попробуй ещё раз');
    }
    return status === 'admin' ? task.target_chat_id : null;
  }

  const { data: project, error } = await db
    .from('projects')
    .select('id, tg_chat_id, tg_bot_is_admin')
    .eq('id', task.target_project_id)
    .maybeSingle();

  if (error) throw error;
  if (!project?.tg_bot_is_admin || project.tg_chat_id === null) return null;
  return project.tg_chat_id;
}
