import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | undefined;

/**
 * Клиент создаётся лениво: без переменных окружения падать должен вызов, а не
 * импорт модуля — иначе приложение не отрисуется вообще.
 *
 * Своей сессии у клиента нет: авторизация идёт через Edge Functions по
 * initData, а напрямую с фронта читаются только публичные витрины под RLS.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY не заданы: скопируй .env.example в .env',
    );
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
