import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized, notFound, HttpError } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { boostStatus, sendMessage } from '../_shared/bot_api.ts';
import { botHelloText, buttonText, localeFromCode } from '../_shared/notify_text.ts';

interface ClaimTaskRequest {
  initData?: string;
  taskId?: number;
}

/** Why a claim paid nothing, when the screen has something to do about it. */
type Reason = 'not_ready' | 'bot_unreachable' | 'not_boosted';

/**
 * «Claim» on a task whose condition the server can check: the daily bonus,
 * the daily goals, the ladders and the one-time actions.
 *
 * What is ready, and what it pays, is decided by `claim_task` in the database
 * from rows the ledger already holds — the same `task_progress` the board is
 * drawn from. This function only adds the facts the database cannot know:
 * where the request came from, the Premium flag of the signed initData, and
 * what Telegram says about a boost or about writing to the person. Votes are
 * still written by `apply_task_completion` alone.
 */
serve('claim-task', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<ClaimTaskRequest>();
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
    .select('id, type, is_active, target_chat_id')
    .eq('id', body.taskId)
    .maybeSingle();
  if (error) throw error;
  // The three older types have their own paths: a click, a friend, a check.
  if (!task || !task.is_active || ['visit', 'subscribe', 'referral'].includes(task.type)) {
    throw notFound('Задание не найдено');
  }

  const facts: Record<string, boolean> = {
    site: verified.source === 'site',
    premium: verified.user.is_premium === true,
  };

  // Telegram is asked only while the task is still open: a done task must
  // not send a second hello or spend a Bot API call on a boost already paid.
  if (task.type === 'bot_dm' || task.type === 'boost') {
    const { count, error: doneError } = await db
      .from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('task_id', task.id)
      .eq('status', 'completed');
    if (doneError) throw doneError;
    if ((count ?? 0) > 0) return await answer(false, 'not_ready');
  }

  if (task.type === 'bot_dm') {
    const { data: user, error: userError } = await db
      .from('users')
      .select('language')
      .eq('id', userId)
      .single();
    if (userError) throw userError;

    const locale = localeFromCode(user.language);
    const sent = await sendMessage(botToken, String(verified.user.id), botHelloText(locale), {
      text: buttonText(locale),
      url: Deno.env.get('APP_URL') ?? 'https://app.bidwar.world/',
    });
    if (!sent.ok) {
      if (!sent.permanent) {
        throw new HttpError(503, 'upstream_unavailable', 'Telegram не ответил — попробуй ещё раз');
      }
      ctx.log('bot cannot write', { userId });
      return await answer(false, 'bot_unreachable');
    }
    facts.bot_reachable = true;
  }

  if (task.type === 'boost') {
    if (task.target_chat_id === null) throw badRequest('У задания нет канала');
    const status = await boostStatus(botToken, task.target_chat_id, verified.user.id);
    if (status === 'unknown') {
      throw new HttpError(503, 'upstream_unavailable', 'Telegram не ответил — попробуй ещё раз');
    }
    if (status === 'no') return await answer(false, 'not_boosted');
    facts.boosted = true;
  }

  const { data, error: claimError } = await db.rpc('claim_task', {
    p_user_id: userId,
    p_task_id: task.id,
    p_facts: facts,
  });
  if (claimError) throw claimError;

  const result = Array.isArray(data) ? data[0] : data;
  const claimed = result?.claimed === true;
  const granted = Number(result?.granted ?? 0);

  ctx.log(claimed ? 'task claimed' : 'task not ready', { userId, taskId: task.id, granted });

  return {
    claimed,
    granted,
    referralGranted: Number(result?.referral_granted ?? 0),
    // From the procedure that changed it, as in check-subscription.
    balanceAfter: Number(result?.balance_after ?? 0),
    ...(claimed ? {} : { reason: 'not_ready' satisfies Reason }),
  };

  /** A refusal before the database was touched still reports the true balance. */
  async function answer(claimed: false, reason: Reason) {
    const { data: user, error: balanceError } = await db
      .from('users')
      .select('vote_balance')
      .eq('id', userId)
      .single();
    if (balanceError) throw balanceError;
    return {
      claimed,
      granted: 0,
      referralGranted: 0,
      balanceAfter: Number(user.vote_balance ?? 0),
      reason,
    };
  }
});
