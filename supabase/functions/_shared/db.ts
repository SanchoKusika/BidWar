import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

let adminClient: SupabaseClient | undefined;

/** service_role-клиент: обходит RLS, только для использования внутри Edge Functions. */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы в окружении функции');
  }

  adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return adminClient;
}
