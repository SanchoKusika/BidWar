import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { fetchOg } from '../_shared/og.ts';

interface AddProjectRequest {
  initData?: string;
  categoryId?: number;
  url?: string;
}

const MAX_URL_LENGTH = 2048;

// projects_one_active_per_{user_and_type,url_and_type}_idx — имена реальных
// уникальных индексов из миграции схемы, по ним и различаем 23505.
const DUPLICATE_USER_INDEX = 'projects_one_active_per_user_and_type_idx';
const DUPLICATE_URL_INDEX = 'projects_one_active_per_url_and_type_idx';

/**
 * Add Project — пока только Free Top. Платный вход это по сути открывающий
 * Raise-платёж (минимум ставки, initial_stake как база для floor будущих
 * атак) — Срез 1.5. Создавать paid-запись с paid_amount=0 в обход платежа
 * значило бы завести дыру в инварианте, на который опирается floor Attack.
 */
serve('add-project', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<AddProjectRequest>();
  if (!body.initData) throw badRequest('initData обязателен');
  if (!body.url || body.url.length > MAX_URL_LENGTH) throw badRequest('Некорректная ссылка');
  if (!Number.isInteger(body.categoryId)) throw badRequest('categoryId обязателен');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.url);
  } catch {
    throw badRequest('Ссылка не распознана');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw badRequest('Ссылка должна быть http(s)');
  }

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);

  const og = await fetchOg(parsedUrl.toString());
  ctx.log('og fetched', { status: og.status });

  const { data, error } = await getAdminClient()
    .from('projects')
    .insert({
      user_id: userId,
      category_id: body.categoryId,
      type: 'free',
      name: og.name,
      url: parsedUrl.toString(),
      og_description: og.description,
      og_image_url: og.imageUrl,
      og_status: og.status,
      og_fetched_at: new Date().toISOString(),
    })
    .select(
      'id, user_id, category_id, type, name, url, og_image_url, og_description, paid_amount, votes, clicks, rank1_since',
    )
    .single();

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes(DUPLICATE_USER_INDEX)) {
        throw badRequest('У тебя уже есть запись в этом топе');
      }
      if (error.message.includes(DUPLICATE_URL_INDEX)) {
        throw badRequest('Эта ссылка уже занята в этом топе');
      }
    }
    if (error.code === '23503') throw badRequest('Категория не найдена');
    throw error;
  }

  ctx.log('created', { projectId: data.id, userId });

  return data;
});
