import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';

interface SpendingRequest {
  initData?: string;
}

/** Сколько чеков показываем — карточка в профиле, а не бухгалтерия. */
const RECEIPT_LIMIT = 20;
const MONTH_MS = 30 * 24 * 3600 * 1000;

interface Receipt {
  id: string;
  intent: 'raise' | 'attack';
  /** Имя проекта, за который платили (у атаки — цели). */
  subject: string | null;
  amount: number;
  currency: string;
  provider: string;
  confirmedAt: string;
}

/**
 * Свои платежи для карточки «PAID» и списка чеков в профиле.
 *
 * Почему отдельная функция, а не чтение через RLS, как витрины: у
 * `payment_transactions` нет политики на чтение, и написать её не на что —
 * сессии Supabase у мини-аппа нет вообще, значит нет и `auth.uid()`
 * (05 Аккаунты и авторизация). Личность живёт в `initData` и проверяется
 * здесь, а сервисный ключ никогда не покидает функцию.
 *
 * Считаются только подтверждённые платежи: `pending` — это ещё не трата, а
 * `failed` — не трата вовсе.
 */
serve('my-spending', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<SpendingRequest>();
  if (!body.initData) throw badRequest('initData обязателен');

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);
  const db = getAdminClient();

  // Суммы берутся в очках (points_granted), а не в original_amount: последний
  // хранит валюту провайдера, и складывать доллары с сумами в одну строку
  // «всего заплачено» нельзя. Очки — единая шкала по 04 Платежи и валюты.
  const { data, error } = await db
    .from('payment_transactions')
    .select(
      'id, intent, points_granted, original_amount, original_currency, provider, confirmed_at, ' +
        'project:projects!payment_transactions_project_id_fkey(name), ' +
        'target:projects!payment_transactions_target_project_id_fkey(name)',
    )
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false })
    .limit(RECEIPT_LIMIT);
  if (error) throw error;

  type Row = {
    id: string;
    intent: 'raise' | 'attack';
    points_granted: number;
    original_amount: number;
    original_currency: string;
    provider: string;
    confirmed_at: string | null;
    project: { name: string } | null;
    target: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  // Итоги считаем отдельным запросом, а не по этим двадцати строкам: список
  // усечён, и сумма по нему была бы меньше настоящей — молча и незаметно.
  const totals = await db
    .from('payment_transactions')
    .select('points_granted, confirmed_at')
    .eq('user_id', userId)
    .eq('status', 'confirmed');
  if (totals.error) throw totals.error;

  const since = Date.now() - MONTH_MS;
  let total = 0;
  let month = 0;
  for (const row of totals.data ?? []) {
    total += row.points_granted;
    if (row.confirmed_at && Date.parse(row.confirmed_at) >= since) month += row.points_granted;
  }

  const receipts: Receipt[] = rows.map((row) => ({
    id: row.id,
    intent: row.intent,
    subject: row.intent === 'attack' ? (row.target?.name ?? null) : (row.project?.name ?? null),
    amount: row.points_granted,
    currency: row.original_currency,
    provider: row.provider,
    // confirmed_at проставляется той же транзакцией, что и статус, — у
    // confirmed он есть всегда; запасной вариант на случай ручной правки.
    confirmedAt: row.confirmed_at ?? new Date(0).toISOString(),
  }));

  ctx.log('spending', { receipts: receipts.length });
  return { month, total, receipts };
});
