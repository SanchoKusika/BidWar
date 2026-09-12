import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, notFound, unauthorized } from '../_shared/http.ts';
import { mockCommandsAllowed } from '../_shared/payments/registry.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';

interface RemoveRequest {
  initData?: string;
}

/**
 * "Remove my projects" from the profile: resets the account to zero.
 *
 * Projects, payment history, stakes, votes and task completions are deleted
 * for real by `reset_user_data` in one transaction, so the profile comes back
 * empty. The account row stays — the next launch reuses it.
 *
 * Money is not refunded; the confirmation sheet says so.
 */
serve('remove-my-projects', async (req, ctx) => {
  // Development tool only: the reset rewrites the payment ledger and resets
  // attack limits and task rewards. It answers only while payments run on the
  // mock — the same switch that separates the test setup from production.
  if (!mockCommandsAllowed()) throw notFound();
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<RemoveRequest>();
  if (!body.initData) throw badRequest('initData обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);

  const { data, error } = await getAdminClient().rpc('reset_user_data', { p_user_id: userId });
  if (error) throw error;

  const removed = Number(data ?? 0);
  ctx.log('account reset', { projects: removed });
  return { removed };
});
