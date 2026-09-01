/**
 * Контракт `attack-quote` (supabase/functions/_shared/attack_quote.ts).
 *
 * Все числа приходят с сервера и здесь не пересчитываются: пол цели,
 * коэффициент зачисления и остаток скользящих лимитов — правила баланса, и
 * вторая их копия в клиенте разъехалась бы с той, по которой спишут деньги.
 */
export interface AttackQuote {
  ownProjectId: number;
  /** Своя ставка — на неё зачислится часть суммы. */
  ownAmount: number;
  targetProjectId: number;
  targetAmount: number;
  /** Ниже этой ставки цель не опустить. */
  floor: number;
  /** Сколько ещё поместится в цель: `targetAmount − floor`. */
  room: number;
  minAttackAmount: number;
  /** Коэффициент зачисления в базисных пунктах: 10000 = 100%. */
  coefficientBp: number;
  attacksLeftOnTarget: number;
  attacksLeftToday: number;
  maxAttacksOnTarget: number;
  maxAttacksToday: number;
  haircutResetHours: number;
}

export interface AttackQuoteParams {
  initData: string;
  targetProjectId: number;
}

export interface CreateAttackParams {
  initData: string;
  /** Сумма в очках: для UZS это и есть сумы (04 Платежи и валюты). */
  amount: number;
  targetProjectId: number;
}
