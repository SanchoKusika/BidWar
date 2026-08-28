import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { TelegramUser } from './telegram.ts';

let adminClient: SupabaseClient | undefined;

/** service_role-клиент: обходит RLS, только для использования внутри Edge Functions. */
function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы в окружении функции');
  }

  adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return adminClient;
}

function displayNameOf(user: TelegramUser): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.username || `tg${user.id}`;
}

// Формат start_param у нас — users.id реферера (см. 02 Архитектура.md), не
// telegram id: леджер и так ничего не знает о способах входа, и uuid
// укладывается в допустимый Telegram алфавит start_param без кодирования.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResolveResult {
  userId: string;
  isNew: boolean;
}

/**
 * Единая точка "пришёл telegram-пользователь → users.id". Вызывается и из
 * auth (initData на старте мини-аппа), и из bot (вебхук /start) — резолвится
 * одинаково независимо от того, как человек впервые до нас добрался.
 *
 * Реферальная награда тут не начисляется — только сохраняется referrer_id.
 * Начисление идёт после первого реального действия приглашённого (07/08).
 */
export async function resolveTelegramUser(
  user: TelegramUser,
  startParam: string | null,
): Promise<ResolveResult> {
  const referrerId = startParam && UUID_RE.test(startParam) ? startParam : null;

  const { data, error } = await getAdminClient().rpc('resolve_telegram_identity', {
    p_telegram_id: String(user.id),
    p_display_name: displayNameOf(user),
    p_avatar_url: user.photo_url ?? null,
    p_meta: {
      username: user.username ?? null,
      language_code: user.language_code ?? null,
      is_premium: user.is_premium ?? null,
    },
    p_referrer_id: referrerId,
  });

  if (error) throw error;
  const row = (data as Array<{ user_id: string; is_new: boolean }> | null)?.[0];
  if (!row) throw new Error('resolve_telegram_identity ничего не вернул');

  return { userId: row.user_id, isNew: row.is_new };
}
