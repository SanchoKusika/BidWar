import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';

interface RemoveRequest {
  initData?: string;
}

/**
 * «Убрать мои проекты» из профиля: свои записи в обоих топах разом.
 *
 * Удаления как такового у продукта нет — строка остаётся, статус становится
 * `hidden` (01 Механики, «Правила жизненного цикла»): на неё ссылается леджер
 * платежей, и стирать её значило бы переписывать историю. Оба уникальных
 * индекса активных записей частичные (`where status = 'active'`), поэтому
 * скрытие освобождает и слот топа, и адрес — тот же проект можно завести
 * заново.
 *
 * Деньги не возвращаются: ставка уже оплачена (04 Платежи и валюты, политика
 * рефандов). Предупреждение об этом стоит в самой шторке подтверждения.
 *
 * `rank1_since` снимается тем же UPDATE: у скрытой строки его быть не должно —
 * иначе `apply_payment` продолжит блокировать её как держателя первого места.
 * Новому лидеру отсчёт проставит ближайший платёж (там же, где он и живёт), а
 * до тех пор корона на витрине просто без времени — врать числом хуже.
 *
 * Блокировок это не путает: за один заход трогаются максимум две строки
 * одного пользователя, из которых в наборе `apply_payment` может оказаться
 * только платная — одна строка цикла не образует.
 */
serve('remove-my-projects', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<RemoveRequest>();
  if (!body.initData) throw badRequest('initData обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);

  const { data, error } = await getAdminClient()
    .from('projects')
    .update({ status: 'hidden', rank1_since: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active')
    .select('id, type');
  if (error) throw error;

  const removed = data ?? [];
  ctx.log('projects removed', { count: removed.length });
  return { removed: removed.length };
});
