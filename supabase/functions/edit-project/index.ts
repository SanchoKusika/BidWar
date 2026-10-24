import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized, notFound } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { parseEditRequest, type EditProjectBody } from './validate.ts';

/**
 * The owner sets the project's name and description by hand. Only those two:
 * the link, the category and the picture stay what the project was added with.
 */
serve('edit-project', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const edit = parseEditRequest(await ctx.body<EditProjectBody>());

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(edit.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);
  const db = getAdminClient();

  const { data: project, error } = await db
    .from('projects')
    .select('id, user_id, status')
    .eq('id', edit.projectId)
    .maybeSingle();

  if (error) throw error;
  if (!project || project.status !== 'active') throw notFound('Проект не найден');
  // 400, not 401: the client reads 401 as an expired session.
  if (project.user_id !== userId) throw badRequest('Это не твой проект');

  const { error: updateError } = await db
    .from('projects')
    .update({ name: edit.name, og_description: edit.description })
    .eq('id', project.id)
    .eq('user_id', userId);
  if (updateError) throw updateError;

  ctx.log('project edited', { projectId: project.id });

  return { name: edit.name, description: edit.description };
});
