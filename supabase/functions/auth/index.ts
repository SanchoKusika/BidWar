import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';

interface AuthRequest {
  initData?: string;
}

/**
 * Дёргается фронтом при старте мини-аппа. Своей сессии не заводит — initData
 * проверяется заново на каждом состояние-меняющем запросе (см.
 * 05 Аккаунты и авторизация), это только точка "зайти первый раз / обновить
 * meta" и получить users.id для текущего экрана.
 */
serve('auth', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const { initData } = await ctx.body<AuthRequest>();
  if (!initData) throw badRequest('initData обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const result = await resolveTelegramUser(verified.user, verified.startParam);
  ctx.log('resolved', { userId: result.userId, isNew: result.isNew });

  return result;
});
