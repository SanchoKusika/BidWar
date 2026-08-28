import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';

interface ClickRequest {
  initData?: string;
  projectId?: number;
}

/**
 * Клик по карточке — не больше раза в сутки на человека (01/03 Данные.md).
 * register_project_click делает вставку в project_clicks и инкремент
 * projects.clicks атомарно, конфликт по PK молча не считает второй раз.
 */
serve('click', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<ClickRequest>();
  if (!body.initData) throw badRequest('initData обязателен');
  if (!Number.isInteger(body.projectId)) throw badRequest('projectId обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);

  const { data, error } = await getAdminClient().rpc('register_project_click', {
    p_project_id: body.projectId,
    p_user_id: userId,
  });

  if (error) throw error;

  return { counted: Boolean(data) };
});
