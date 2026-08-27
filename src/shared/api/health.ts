import { getSupabase } from './client';

export interface Health {
  ok: boolean;
  /** `APP_VERSION` из окружения функции, `dev` — если не задан. */
  version: string;
  region: string | null;
  time: string;
}

/** Дозвон до Edge Function `health`. Бросает, если функция недоступна. */
export async function fetchHealth(): Promise<Health> {
  const { data, error } = await getSupabase().functions.invoke<Health>('health', {
    method: 'GET',
  });
  if (error) throw error;
  if (!data?.ok) throw new Error('health ответил не ok');
  return data;
}
