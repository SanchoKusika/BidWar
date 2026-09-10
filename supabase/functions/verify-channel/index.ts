import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized, notFound } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { channelUsername, findChannel, isBotAdmin } from '../_shared/bot_api.ts';

interface VerifyChannelRequest {
  initData?: string;
  projectId?: number;
}

/**
 * «Проверить» на своём платном проекте: стал ли бот администратором канала.
 *
 * Шаг онбординга владельца, а не требование к нему (06 Telegram-бот): отказ
 * ничего не ломает — проект живёт дальше, просто без subscribe-задания. Именно
 * поэтому здесь нет ни одной ошибки на «не канал» и «бот не админ»: это
 * обычные ответы, а не сбои.
 *
 * Проверять чужой проект нельзя: задание появится у чужой записи, а права в
 * канале — дело его владельца.
 */
serve('verify-channel', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<VerifyChannelRequest>();
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
    .select('id, user_id, url, type, status')
    .eq('id', body.projectId)
    .maybeSingle();

  if (error) throw error;
  if (!project) throw notFound('Проект не найден');
  if (project.user_id !== userId) throw unauthorized('Это не твой проект');

  const username = channelUsername(project.url);
  if (username === null) {
    ctx.log('not a channel link', { projectId: project.id });
    return { isChannel: false, isAdmin: false };
  }

  const channel = await findChannel(botToken, username);
  if (channel === null) {
    ctx.log('channel not found', { projectId: project.id, username });
    return { isChannel: false, isAdmin: false };
  }

  const admin = await isBotAdmin(botToken, channel.chatId);

  // Хранимка одна на два входа — этот и апдейт `my_chat_member`: правило «есть
  // права → есть задание» обязано быть одним и тем же.
  const { error: applyError } = await db.rpc('apply_channel_admin', {
    p_chat_id: channel.chatId,
    p_username: username,
    p_is_admin: admin,
  });
  if (applyError) throw applyError;

  ctx.log('channel verified', { projectId: project.id, username, admin });

  return { isChannel: true, isAdmin: admin, username };
});
