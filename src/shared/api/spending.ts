import { getSupabase } from './client';
import { functionErrorMessage } from './errors';

/** Один подтверждённый платёж — строка в списке чеков профиля. */
export interface SpendingReceipt {
  id: string;
  intent: 'raise' | 'attack';
  /** Проект, за который платили; у атаки — цель. null, если проект скрыт. */
  subject: string | null;
  /** Сумма в очках: единая шкала, в ней же считаются итоги. */
  amount: number;
  /** Валюта, в которой человек реально платил. */
  currency: string;
  provider: string;
  confirmedAt: string;
}

export interface Spending {
  /** За последние 30 дней. */
  month: number;
  /** За всё время. */
  total: number;
  receipts: readonly SpendingReceipt[];
}

/**
 * Свои траты. Отдельная функция, а не чтение через RLS: у
 * `payment_transactions` нет политики на чтение, и написать её не на что —
 * сессии Supabase у мини-аппа нет, `auth.uid()` не существует. Личность
 * доказывается подписанным `initData` на сервере.
 */
export async function fetchMySpending(initData: string): Promise<Spending> {
  const { data, error } = await getSupabase().functions.invoke<Spending>('my-spending', {
    method: 'POST',
    body: { initData },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось загрузить траты'));
  if (!data) throw new Error('my-spending ответил пусто');
  return data;
}
