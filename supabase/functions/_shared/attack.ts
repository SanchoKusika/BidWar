/**
 * Арифметика Attack (01 Механики, срез 1.6).
 *
 * Одни и те же числа считаются в трёх местах: предпросмотр в шторке
 * (`attack-quote`), проверка при создании инвойса (`create-payment`) и
 * окончательный расчёт в `apply_payment`. Расхождение между ними — это
 * человек, заплативший за один эффект и получивший другой, поэтому
 * арифметика вынесена сюда и держится **целочисленной**.
 *
 * Почему целые, а не доли: SQL считает по тем же формулам, и `0.15 * 3` в
 * double даёт `0.44999999999999996` — коэффициент 0.55000000000000004 вместо
 * 0.55. На больших ставках такой хвост меняет зачисление на единицу, и
 * предпросмотр перестаёт сходиться с фактом. В `app_config` проценты и так
 * лежат целыми (`attack_haircut_step_pct: 15`), дробить их незачем: хейркат
 * считается в базисных пунктах, floor — целочисленным делением на 100. Обе
 * операции усечения совпадают с `/` для bigint в Postgres.
 */

export interface AttackLimits {
  /** Минимум платного топа: пол атаки никогда не опускается ниже него. */
  minPaidAmount: number;
  minAttackAmount: number;
  maxAttacksPerTargetPerDay: number;
  maxAttacksTotalPerDay: number;
  /** Целые проценты, ровно как в app_config.paid_limits. */
  attackFloorPctOfInitial: number;
  attackHaircutFloorPct: number;
  attackHaircutStepPct: number;
  attackHaircutResetHours: number;
}

function intField(source: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`app_config.paid_limits.${key} отсутствует или вне диапазона [${min}, ${max}]`);
  }
  return value;
}

/**
 * Молчаливый дефолт здесь стоил бы денег: подставить 50% там, где в конфиге
 * опечатка, значит тихо изменить баланс игры. Тот же приём, что в
 * `parsePaidLimits` и `fetchFxRates` — отсутствие ключа это ошибка, а не повод
 * достать константу.
 */
export function parseAttackLimits(value: unknown): AttackLimits {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    minPaidAmount: intField(v, 'min_paid_amount', 1, Number.MAX_SAFE_INTEGER),
    minAttackAmount: intField(v, 'min_attack_amount', 1, Number.MAX_SAFE_INTEGER),
    maxAttacksPerTargetPerDay: intField(v, 'max_attacks_per_target_per_day', 1, 1000),
    maxAttacksTotalPerDay: intField(v, 'max_attacks_total_per_day', 1, 1000),
    attackFloorPctOfInitial: intField(v, 'attack_floor_pct_of_initial', 0, 100),
    attackHaircutFloorPct: intField(v, 'attack_haircut_floor_pct', 0, 100),
    attackHaircutStepPct: intField(v, 'attack_haircut_step_pct', 0, 100),
    attackHaircutResetHours: intField(v, 'attack_haircut_reset_hours', 1, 24 * 365),
  };
}

export interface AttackTarget {
  paidAmount: number;
  /** Первая ставка проекта. null у строк, заведённых до backfill-миграции. */
  initialStake: number | null;
}

/**
 * Нижняя граница ставки цели: `max(MIN_PAID_AMOUNT, pct × initial_stake)`.
 *
 * `initial_stake` пустой — считаем от текущей ставки. Это строже, а не мягче:
 * такой проект защищён сильнее обычного, и ошибка играет в пользу жертвы, а
 * не атакующего.
 */
export function attackFloor(target: AttackTarget, limits: AttackLimits): number {
  const base = target.initialStake ?? target.paidAmount;
  const share = Number((BigInt(base) * BigInt(limits.attackFloorPctOfInitial)) / 100n);
  return Math.max(limits.minPaidAmount, share);
}

/** Сколько ещё можно снять с цели, прежде чем она упрётся в пол. */
export function attackRoom(
  target: AttackTarget,
  limits: AttackLimits,
): { floor: number; room: number } {
  const floor = attackFloor(target, limits);
  return { floor, room: Math.max(0, target.paidAmount - floor) };
}

/**
 * Коэффициент зачисления в базисных пунктах (10000 = 100%).
 *
 * Считается по паре «атакующий → цель»: первая атака на эту цель внутри окна
 * `attackHaircutResetHours` — 100%, каждая следующая минус шаг, до пола. Атака
 * на другую цель начинается со 100% независимо от истории — наказывается
 * долбёжка одной жертвы, а не активность вообще.
 */
export function haircutBp(priorAttacks: number, limits: AttackLimits): number {
  const decayed = 10000 - limits.attackHaircutStepPct * 100 * priorAttacks;
  return Math.max(limits.attackHaircutFloorPct * 100, decayed);
}

/**
 * Сколько очков долетит до ставки атакующего. Усечение, а не округление:
 * разница остаётся у площадки как часть уже оплаченной суммы, и зачислить
 * лишнюю единицу — значит подарить очко из воздуха.
 */
export function creditedPoints(landed: number, bp: number): number {
  return Number((BigInt(landed) * BigInt(bp)) / 10000n);
}
