import { getAdminClient } from '../db.ts';

export interface FxRates {
  rubToUzs: number;
  usdToUzs: number;
}

/** Значения из init_schema — если строки конфига нет, курс выдумывать нельзя. */
const FALLBACK: FxRates = { rubToUzs: 135, usdToUzs: 12100 };

/**
 * Курсы фиксированные и лежат в app_config: топ не должен дёргаться от
 * колебаний рынка, а внешняя зависимость в платёжном пути — лишняя точка отказа
 * (04 Платежи и валюты).
 */
export async function fetchFxRates(): Promise<FxRates> {
  const { data, error } = await getAdminClient()
    .from('app_config')
    .select('value')
    .eq('key', 'fx_rates')
    .maybeSingle();

  if (error) throw error;
  const v = (data?.value ?? {}) as { rub_to_uzs?: number; usd_to_uzs?: number };
  return {
    rubToUzs: v.rub_to_uzs ?? FALLBACK.rubToUzs,
    usdToUzs: v.usd_to_uzs ?? FALLBACK.usdToUzs,
  };
}

/**
 * Якорь: 1 очко = 1 UZS, поэтому для основного рынка конвертация тождественна.
 * Возвращает и применённый курс — он пишется в payment_transactions.fx_rate_used
 * и больше никогда не пересчитывается.
 */
export function toPoints(
  amount: bigint,
  currency: string,
  rates: FxRates,
): { points: bigint; rate: string } {
  if (amount <= 0n) throw new Error(`Сумма должна быть положительной: ${amount}`);

  switch (currency) {
    case 'UZS':
      return { points: amount, rate: '1' };
    case 'RUB':
      return { points: amount * BigInt(rates.rubToUzs), rate: String(rates.rubToUzs) };
    case 'USD':
      return { points: amount * BigInt(rates.usdToUzs), rate: String(rates.usdToUzs) };
    default:
      throw new Error(`Неизвестная валюта: ${currency}`);
  }
}
