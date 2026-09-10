import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';

interface CastVotesRequest {
  initData?: string;
  projectId?: number;
  amount?: number;
}

/**
 * Отдать голоса проекту. Своему или чужому — правила это разрешают
 * (01 Механики), и проверки владения здесь нет намеренно.
 *
 * Решает всё хранимка `cast_votes`: она одна двигает `users.vote_balance` и
 * `projects.votes`, под блокировками и в одной транзакции. Функция только
 * устанавливает личность и переводит причину отказа в человеческий текст —
 * дублировать здесь хоть одно правило значит завести второй источник правды.
 */
const REASONS: Record<string, string> = {
  bad_amount: 'Количество голосов должно быть больше нуля',
  bad_target: 'Голоса принимает только активный проект бесплатного топа',
  insufficient_balance: 'Столько голосов на балансе нет',
  no_user: 'Аккаунт не найден',
};

serve('cast-votes', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<CastVotesRequest>();
  if (!body.initData) throw badRequest('initData обязателен');
  if (!Number.isInteger(body.projectId)) throw badRequest('projectId обязателен');
  if (!Number.isInteger(body.amount) || (body.amount as number) <= 0) {
    throw badRequest('amount должен быть целым больше нуля');
  }

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);

  const { data, error } = await getAdminClient().rpc('cast_votes', {
    p_user_id: userId,
    p_project_id: body.projectId,
    p_amount: body.amount,
  });

  if (error) throw error;

  // Хранимка возвращает таблицу — одна строка.
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error('cast_votes ответил пусто');

  if (!result.applied) {
    const reason = String(result.reason ?? 'bad_amount');
    ctx.log('votes declined', { userId, projectId: body.projectId, reason });
    throw badRequest(REASONS[reason] ?? 'Голоса не приняты', { reason });
  }

  ctx.log('votes cast', { userId, projectId: body.projectId, amount: body.amount });

  return { applied: true, balanceAfter: Number(result.balance_after) };
});
