import { badRequest, notFound } from './http.ts';
import { getAdminClient } from './db.ts';
import { attackRoom, haircutBp, parseAttackLimits, type AttackLimits } from './attack.ts';

/**
 * Всё, что нужно знать про одну конкретную атаку «этот пользователь → эта
 * цель», собранное из базы и посчитанное по правилам 01 Механики.
 *
 * Один загрузчик на две функции: `attack-quote` отдаёт это шторке для
 * предпросмотра, `create-payment` считает по нему сумму инвойса. Разъехавшись,
 * они показали бы человеку один эффект, а выставили счёт за другой.
 * Окончательное слово всё равно за `apply_payment` — она пересчитывает то же
 * самое под блокировкой строк, потому что между предпросмотром и
 * подтверждением ставка цели может измениться.
 */
export interface AttackQuote {
  ownProjectId: number;
  ownAmount: number;
  targetProjectId: number;
  targetAmount: number;
  /** Ниже этой ставки цель не опустить. */
  floor: number;
  /** Сколько ещё можно снять с цели: `paid_amount − floor`. */
  room: number;
  minAttackAmount: number;
  /** Коэффициент зачисления в базисных пунктах: 10000 = 100%. */
  coefficientBp: number;
  attacksLeftOnTarget: number;
  attacksLeftToday: number;
  /** Максимумы и окно сброса — чтобы шторка не хранила второй копии лимитов. */
  maxAttacksOnTarget: number;
  maxAttacksToday: number;
  haircutResetHours: number;
}

const HOUR_MS = 3_600_000;

type Db = ReturnType<typeof getAdminClient>;

/** Скользящее окно, а не календарные сутки: иначе полночь выдаёт двойную пачку. */
async function countAttacks(
  db: Db,
  userId: string,
  targetProjectId: number | null,
  since: Date,
): Promise<number> {
  let query = db
    .from('stake_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('actor_user_id', userId)
    .eq('type', 'attack_out')
    .gt('created_at', since.toISOString());
  if (targetProjectId !== null) query = query.eq('target_project_id', targetProjectId);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function loadAttackLimits(db: Db): Promise<AttackLimits> {
  const { data, error } = await db
    .from('app_config')
    .select('value')
    .eq('key', 'paid_limits')
    .single();
  if (error) throw error;
  return parseAttackLimits(data.value);
}

export async function loadAttackQuote(
  userId: string,
  targetProjectId: number,
): Promise<AttackQuote> {
  const db = getAdminClient();
  const limits = await loadAttackLimits(db);

  // Атака зачисляет часть суммы на СВОЮ ставку — без платной записи зачислять
  // некуда, и это не «нечего показать», а невозможность действия.
  const { data: own, error: ownError } = await db
    .from('projects')
    .select('id, paid_amount')
    .eq('user_id', userId)
    .eq('type', 'paid')
    .eq('status', 'active')
    .maybeSingle();
  if (ownError) throw ownError;
  if (!own) throw badRequest('Атака бьёт по ставке — сначала займи место в платном топе');

  const { data: target, error: targetError } = await db
    .from('projects')
    .select('id, user_id, type, status, paid_amount, initial_stake')
    .eq('id', targetProjectId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw notFound('Проект не найден');
  if (target.type !== 'paid') throw badRequest('Атаковать можно только платные проекты');
  if (target.status !== 'active') throw badRequest('Проект неактивен');
  if (target.id === own.id || target.user_id === userId) {
    throw badRequest('Свой проект не атакуют');
  }

  const now = Date.now();
  const day = new Date(now - 24 * HOUR_MS);
  const haircutWindow = new Date(now - limits.attackHaircutResetHours * HOUR_MS);

  // Окна разные и путать их нельзя: лимиты живут в сутках, хейркат — в своём
  // окне сброса (по умолчанию 48 часов). Один счётчик на оба правила тихо
  // занижал бы зачисление.
  const [hitsOnTargetToday, hitsToday, hitsInHaircutWindow] = await Promise.all([
    countAttacks(db, userId, targetProjectId, day),
    countAttacks(db, userId, null, day),
    countAttacks(db, userId, targetProjectId, haircutWindow),
  ]);

  const { floor, room } = attackRoom(
    { paidAmount: target.paid_amount, initialStake: target.initial_stake },
    limits,
  );

  return {
    ownProjectId: own.id,
    ownAmount: own.paid_amount,
    targetProjectId: target.id,
    targetAmount: target.paid_amount,
    floor,
    room,
    minAttackAmount: limits.minAttackAmount,
    coefficientBp: haircutBp(hitsInHaircutWindow, limits),
    attacksLeftOnTarget: Math.max(0, limits.maxAttacksPerTargetPerDay - hitsOnTargetToday),
    attacksLeftToday: Math.max(0, limits.maxAttacksTotalPerDay - hitsToday),
    maxAttacksOnTarget: limits.maxAttacksPerTargetPerDay,
    maxAttacksToday: limits.maxAttacksTotalPerDay,
    haircutResetHours: limits.attackHaircutResetHours,
  };
}

/**
 * Пускать ли атаку на такую сумму. Отдельно от расчёта, потому что вызывается
 * только на пути создания инвойса: предпросмотру отказ не нужен, ему нужны
 * числа, по которым он сам покажет, почему кнопка не нажимается.
 */
export function assertAttackAllowed(quote: AttackQuote, amount: number): void {
  if (quote.attacksLeftOnTarget <= 0) {
    throw badRequest('Лимит атак по этой цели на сегодня исчерпан');
  }
  if (quote.attacksLeftToday <= 0) {
    throw badRequest('Лимит атак на сегодня исчерпан');
  }
  if (amount < quote.minAttackAmount) {
    throw badRequest(`Минимум атаки — ${quote.minAttackAmount}`);
  }
  // Урезать уже выставленный инвойс нельзя, а списать полную сумму и применить
  // частичный эффект — тем более (01 Механики). Поэтому не «подгоняем», а
  // отказываем: шторка считает по тем же floor и room и показывает урезанную
  // сумму ДО оплаты, так что сюда попадает только устаревший запрос.
  if (amount > quote.room) {
    throw badRequest(
      quote.room <= 0
        ? 'Цель уже на своём минимуме — ниже её не опустить'
        : `Ставка цели изменилась: сейчас в неё поместится не больше ${quote.room}`,
    );
  }
}
