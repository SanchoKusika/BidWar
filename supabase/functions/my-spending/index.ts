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

interface Receipt {
  id: string;
  intent: 'raise' | 'attack';
  /** Имя проекта, за который платили (у атаки — цели). */
  subject: string | null;
  amount: number;
  /** Сколько и в какой валюте реально списали. В чеке показывается это. */
  charged: number;
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

  // Totals are summed in SQL, not over rows fetched here: the receipts list is
  // cut to twenty, and a fetch of every row is cut by the API's max_rows
  // (1000) — either way the sum would silently come out smaller than the truth.
  const totals = await db.rpc('spending_totals', { p_user_id: userId });
  if (totals.error) throw totals.error;
  const sums = (Array.isArray(totals.data) ? totals.data[0] : totals.data) as
    { total: number; month: number } | undefined;
  const total = Number(sums?.total ?? 0);
  const month = Number(sums?.month ?? 0);

  const receipts: Receipt[] = rows.map((row) => ({
    id: row.id,
    intent: row.intent,
    subject: row.intent === 'attack' ? (row.target?.name ?? null) : (row.project?.name ?? null),
    amount: row.points_granted,
    // Сумма и валюта списания идут отдельно от очков: в чеке показывается
    // ровно то, что ушло с карты, и это не пересчитывается никогда
    // (04 Платежи и валюты). Очки остаются для итогов — складывать доллары
    // с сумами в одну строку «всего заплачено» нельзя.
    charged: row.original_amount,
    currency: row.original_currency,
    provider: row.provider,
    // confirmed_at проставляется той же транзакцией, что и статус, — у
    // confirmed он есть всегда; запасной вариант на случай ручной правки.
    confirmedAt: row.confirmed_at ?? new Date(0).toISOString(),
  }));

  ctx.log('spending', { receipts: receipts.length });
  return { month, total, receipts };
});
