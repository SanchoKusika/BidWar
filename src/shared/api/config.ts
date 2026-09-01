import { getSupabase } from './client';

export interface PaidLimits {
  /** Минимальная ставка и минимальный открывающий бид. */
  minPaidAmount: number;
  /** Минимальная сумма атаки. */
  minAttackAmount: number;
  maxAttacksPerTargetPerDay: number;
  maxAttacksTotalPerDay: number;
  /** Доля от начальной ставки, ниже которой ставку жертвы не опустить. */
  attackFloorOfInitial: number;
  /** Нижняя граница коэффициента зачисления при повторных атаках. */
  attackHaircutFloor: number;
  /** На сколько падает коэффициент за каждую предыдущую атаку по той же цели. */
  attackHaircutStep: number;
  attackHaircutResetHours: number;
}

/** Значения из init_schema — страховка на случай, если строки конфига нет. */
const FALLBACK: PaidLimits = {
  minPaidAmount: 50000,
  minAttackAmount: 10000,
  maxAttacksPerTargetPerDay: 3,
  maxAttacksTotalPerDay: 10,
  attackFloorOfInitial: 0.5,
  attackHaircutFloor: 0.5,
  attackHaircutStep: 0.15,
  attackHaircutResetHours: 48,
};

interface PaidLimitsRow {
  min_paid_amount?: number;
  min_attack_amount?: number;
  max_attacks_per_target_per_day?: number;
  max_attacks_total_per_day?: number;
  attack_floor_pct_of_initial?: number;
  attack_haircut_floor_pct?: number;
  attack_haircut_step_pct?: number;
  attack_haircut_reset_hours?: number;
}

/** Проценты в конфиге хранятся целыми — дробная арифметика живёт только здесь. */
const pct = (value: number | undefined, fallback: number): number =>
  value === undefined ? fallback : value / 100;

/**
 * `app_config.paid_limits` — единственный источник правды по лимитам ставок и
 * атак. Шторки Raise и Attack показывают предварительный расчёт («заплатишь
 * столько, у соперника упадёт столько»), и считать его на своих числах нельзя:
 * они разъедутся с сервером. Поэтому все коэффициенты приезжают отсюда, а
 * окончательный расчёт всё равно делает edge-функция при подтверждении.
 */
export async function fetchPaidLimits(): Promise<PaidLimits> {
  const { data, error } = await getSupabase()
    .from('app_config')
    .select('value')
    .eq('key', 'paid_limits')
    .single();

  if (error) throw error;

  const v = (data.value ?? {}) as PaidLimitsRow;
  return {
    minPaidAmount: v.min_paid_amount ?? FALLBACK.minPaidAmount,
    minAttackAmount: v.min_attack_amount ?? FALLBACK.minAttackAmount,
    maxAttacksPerTargetPerDay:
      v.max_attacks_per_target_per_day ?? FALLBACK.maxAttacksPerTargetPerDay,
    maxAttacksTotalPerDay: v.max_attacks_total_per_day ?? FALLBACK.maxAttacksTotalPerDay,
    attackFloorOfInitial: pct(v.attack_floor_pct_of_initial, FALLBACK.attackFloorOfInitial),
    attackHaircutFloor: pct(v.attack_haircut_floor_pct, FALLBACK.attackHaircutFloor),
    attackHaircutStep: pct(v.attack_haircut_step_pct, FALLBACK.attackHaircutStep),
    attackHaircutResetHours: v.attack_haircut_reset_hours ?? FALLBACK.attackHaircutResetHours,
  };
}

export { FALLBACK as PAID_LIMITS_FALLBACK };

interface FxRatesRow {
  usd_to_uzs?: number;
  rub_to_uzs?: number;
}

/**
 * Курсы к очку (1 очко = 1 сум по якорю) из `app_config.fx_rates` — тот же
 * источник, по которому считает `create-payment`. Валюта показа в профиле не
 * должна опираться на второй набор чисел в клиенте: разъехавшись, они покажут
 * человеку не ту сумму, что списал провайдер.
 *
 * Строки нет или курс битый — возвращаем то, что удалось разобрать: у
 * `formatMoney` остаётся его собственный набор, и показ просто не меняется.
 */
export async function fetchFxRates(): Promise<{ USD?: number; RUB?: number }> {
  const { data, error } = await getSupabase()
    .from('app_config')
    .select('value')
    .eq('key', 'fx_rates')
    .maybeSingle();

  if (error) throw error;

  const v = (data?.value ?? {}) as FxRatesRow;
  return {
    ...(v.usd_to_uzs ? { USD: 1 / v.usd_to_uzs } : {}),
    ...(v.rub_to_uzs ? { RUB: 1 / v.rub_to_uzs } : {}),
  };
}
