import { getSupabase } from './client';

export interface PaidLimits {
  minPaidAmount: number;
  minAttackAmount: number;
}

/**
 * `app_config.paid_limits` — минимальная ставка нужна на фронте уже сейчас
 * для подсказки "цена этой позиции" на карточках (ProjectCard.spotPrice),
 * дальше пригодится для валидации Raise.
 */
export async function fetchPaidLimits(): Promise<PaidLimits> {
  const { data, error } = await getSupabase()
    .from('app_config')
    .select('value')
    .eq('key', 'paid_limits')
    .single();

  if (error) throw error;

  const value = data.value as { min_paid_amount?: number; min_attack_amount?: number } | null;
  return {
    minPaidAmount: value?.min_paid_amount ?? 50000,
    minAttackAmount: value?.min_attack_amount ?? 10000,
  };
}
