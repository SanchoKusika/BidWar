import { getSupabase } from './client';
import { functionErrorMessage } from './errors';

export interface AuthResult {
  userId: string;
  isNew: boolean;
  displayName: string;
  avatarUrl: string | null;
  voteBalance: number;
  /** Телеграм-хендл без «@». null — у аккаунта его просто нет, это допустимо. */
  username: string | null;
  /** Дата регистрации (users.created_at) — «joined ...» в шапке профиля. */
  joinedAt: string;
  /** Сколько человек пришло по реферальной ссылке. */
  invitedCount: number;
}

/**
 * Дозвон до Edge Function `auth` с initData текущей площадки. Своей сессии
 * не заводит: результат используется только чтобы показать/обновить экран,
 * последующие state-меняющие вызовы проверяют initData заново сами.
 */
export async function authenticate(initData: string): Promise<AuthResult> {
  const { data, error } = await getSupabase().functions.invoke<AuthResult>('auth', {
    method: 'POST',
    body: { initData },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось войти'));
  if (!data) throw new Error('auth ответил пусто');
  return data;
}
