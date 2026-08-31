import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized, notFound } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { fetchOg } from '../_shared/og.ts';
import { fetchFxRates, toPoints } from '../_shared/payments/fx.ts';
import { getProvider, mockCommandsAllowed } from '../_shared/payments/registry.ts';
import type { MockCommand } from '../_shared/payments/mock.ts';
import {
  parseRequest,
  assertMinPaidAmount,
  parsePaidLimits,
  type CreatePaymentBody,
} from './validate.ts';

// projects_one_pending_per_user_and_type_idx — миграция
// 20260831100000_pending_payment_unique_index.sql. Единственный unique-индекс,
// который может дать 23505 на insert ниже: активные индексы (user_and_type,
// url_and_type) ограничены status = 'active' и на pending_payment не смотрят.
const PENDING_SLOT_INDEX = 'projects_one_pending_per_user_and_type_idx';

/**
 * Единственная точка, где начинается платёж. Валидация трижды, а не дважды
 * (04 Платежи и валюты): здесь, в pre_checkout_query у реального провайдера и в
 * транзакции применения. Эта — первая.
 */
serve('create-payment', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<CreatePaymentBody>();
  const db = getAdminClient();

  // Схемный разбор (типы, целостность, синтаксис URL) не трогает базу и идёт
  // до verifyInitData. Сравнение с минимумом ставки — после: оно само читает
  // app_config, а до подписи это чтение делать нельзя.
  const parsed = parseRequest(body);

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');
  const verified = await verifyInitData(parsed.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);

  const { data: limits, error: limitsError } = await db
    .from('app_config')
    .select('value')
    .eq('key', 'paid_limits')
    .single();
  if (limitsError) throw limitsError;
  const { minPaidAmount } = parsePaidLimits(limits.value);
  assertMinPaidAmount(parsed.amount, minPaidAmount);

  let projectId: number;

  if (parsed.kind === 'topup') {
    const { data: project, error } = await db
      .from('projects')
      .select('id, user_id, type, status')
      .eq('id', parsed.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!project) throw notFound('Проект не найден');
    if (project.user_id !== userId) throw badRequest('Это не твой проект');
    if (project.type !== 'paid') throw badRequest('Ставка есть только у платных проектов');
    if (project.status !== 'active') throw badRequest('Проект неактивен');
    projectId = project.id;
  } else {
    // Занятость слота и занятость адреса — два разных unique-индекса
    // (projects_one_active_per_{user_and_type,url_and_type}_idx) и две разных
    // причины отказа для пользователя. Один `.or(...)` с `.maybeSingle()`
    // здесь не годится: при совпадении сразу обеих строк maybeSingle() бросит
    // вместо внятного ответа, а адрес с запятой или скобкой в query-string
    // сломает синтаксис фильтра PostgREST.
    const { data: ownSlot, error: ownSlotError } = await db
      .from('projects')
      .select('id')
      .eq('type', 'paid')
      .eq('status', 'active')
      .eq('user_id', userId)
      .maybeSingle();
    if (ownSlotError) throw ownSlotError;
    if (ownSlot) throw badRequest('Слот платного топа уже занят');

    const { data: urlTaken, error: urlTakenError } = await db
      .from('projects')
      .select('id')
      .eq('type', 'paid')
      .eq('status', 'active')
      .eq('url', parsed.url)
      .maybeSingle();
    if (urlTakenError) throw urlTakenError;
    if (urlTaken) throw badRequest('Этот адрес уже в платном топе');

    const og = await fetchOg(parsed.url);
    ctx.log('og fetched', { status: og.status });

    // Брошенные оплаты не копятся: у пользователя не больше одной строки
    // pending_payment на топ. Удалять нельзя — на неё ссылается платёж.
    // Инвариант обеспечен на уровне БД (projects_one_pending_per_user_and_type_idx,
    // миграция 20260831100000), а не только этой проверкой: между этим SELECT
    // и insert ниже конкурентный запрос того же пользователя мог успеть
    // вставить свою pending_payment-строку — тогда insert словит 23505.
    const { data: abandoned, error: abandonedError } = await db
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'paid')
      .eq('status', 'pending_payment')
      .maybeSingle();
    if (abandonedError) throw abandonedError;

    const fields = {
      user_id: userId,
      category_id: parsed.categoryId,
      type: 'paid' as const,
      status: 'pending_payment' as const,
      name: og.name,
      url: parsed.url,
      og_description: og.description,
      og_image_url: og.imageUrl,
      og_status: og.status,
      og_fetched_at: new Date().toISOString(),
    };

    let row: { id: number };
    if (abandoned) {
      const { data, error: writeError } = await db
        .from('projects')
        .update(fields)
        .eq('id', abandoned.id)
        .select('id')
        .single();
      if (writeError) throw writeError;
      row = data;
    } else {
      const { data, error: writeError } = await db
        .from('projects')
        .insert(fields)
        .select('id')
        .single();
      if (writeError) {
        if (writeError.code === '23505' && writeError.message.includes(PENDING_SLOT_INDEX)) {
          throw badRequest('У тебя уже есть незавершённая оплата этого топа — попробуй ещё раз');
        }
        throw writeError;
      }
      row = data;
    }
    projectId = row.id;
  }

  const provider = getProvider(
    mockCommandsAllowed() ? (body.mockCommand as MockCommand | undefined) : undefined,
  );

  // fetchFxRates бросает, если строки app_config.fx_rates или нужного в ней
  // ключа нет (см. комментарий в fx.ts) — это осознанно: молчаливый хардкод
  // курса уже чинили по ревью. Но мок работает в UZS, а toPoints для UZS в
  // rates вообще не заглядывает (курс 1:1 — якорь), поэтому звать
  // fetchFxRates безусловно значило бы ронять платёж мока пустым/неполным
  // fx_rates без всякой причины. Курс запрашивается только когда валюта
  // провайдера правда в нём нуждается.
  // NaN — не 0: если toPoints когда-нибудь начнёт заглядывать в rates для UZS,
  // тест на согласованность points/rate сразу заметит порчу, а не тихо посчитает по нулевому курсу.
  const rates =
    provider.currency === 'UZS' ? { rubToUzs: NaN, usdToUzs: NaN } : await fetchFxRates();
  const { points, rate } = toPoints(parsed.amount, provider.currency, rates);

  const { data: payment, error: paymentError } = await db
    .from('payment_transactions')
    .insert({
      user_id: userId,
      project_id: projectId,
      intent: 'raise',
      provider: provider.id,
      original_currency: provider.currency,
      original_amount: Number(parsed.amount),
      fx_rate_used: rate,
      points_granted: Number(points),
      status: 'pending',
    })
    .select('id')
    .single();
  if (paymentError) throw paymentError;

  const result = await provider.createPayment({
    paymentId: payment.id,
    userId,
    intent: 'raise',
    projectId,
    amount: parsed.amount,
  });

  ctx.log('payment created', { paymentId: payment.id, status: result.status, projectId });
  return result;
});
