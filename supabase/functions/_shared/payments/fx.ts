/**
 * Points are anchored to the rouble: 1 point = 1 RUB (04 Платежи и валюты).
 * Platega charges in roubles only, so the conversion is the identity and needs
 * no rates at all.
 *
 * Until the Russia-only pivot points were anchored to UZS and RUB/USD came in
 * through fixed rates in `app_config.fx_rates`, with exact fractional maths in
 * bigint. That code is kept under the `archive/multi-market` tag — bring it
 * back, re-pointed at RUB, when a provider charging in another currency
 * arrives.
 *
 * Returns the applied rate too: it is written to
 * payment_transactions.fx_rate_used and never recalculated.
 */
export const POINT_CURRENCY = 'RUB';

export function toPoints(amount: bigint, currency: string): { points: bigint; rate: string } {
  if (amount <= 0n) throw new Error(`Сумма должна быть положительной: ${amount}`);
  // An unknown currency is an error, not a silent rate of 1: crediting
  // 50 000 som as 50 000 roubles would hand out positions for nothing.
  if (currency !== POINT_CURRENCY) {
    throw new Error(`Валюта ${currency} не поддержана: очки считаются только в ${POINT_CURRENCY}`);
  }
  return { points: amount, rate: '1' };
}
