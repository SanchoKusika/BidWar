import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { loadAttackQuote } from '../_shared/attack_quote.ts';

interface AttackQuoteRequest {
  initData?: string;
  targetProjectId?: number;
}

/**
 * Числа для шторки Attack: пол цели, сколько в неё ещё поместится, коэффициент
 * зачисления и остаток суточных лимитов.
 *
 * Почему отдельная функция, а не чтение из клиента: счётчики атак лежат в
 * `stake_transactions`, у которой нет политики на чтение, а сессии Supabase у
 * мини-аппа нет — личность живёт в `initData` и проверяется здесь. Считать же
 * коэффициент и пол в клиенте нельзя вдвойне: это правила баланса, и
 * расхождение с сервером человек увидит как «обещали одно, списали за другое».
 */
serve('attack-quote', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<AttackQuoteRequest>();
  if (!body.initData) throw badRequest('initData обязателен');
  if (!Number.isInteger(body.targetProjectId)) throw badRequest('targetProjectId обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);
  const quote = await loadAttackQuote(userId, body.targetProjectId!);

  ctx.log('attack quote', {
    targetProjectId: quote.targetProjectId,
    room: quote.room,
    coefficientBp: quote.coefficientBp,
  });
  return quote;
});
