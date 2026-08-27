import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from '../_shared/http.ts';

/**
 * Проверка связности: фронт → Edge Function → окружение.
 *
 * Смысл не в ответе, а в том, что путь пройден целиком — деплой, CORS,
 * вызов с клиента и чтение переменных окружения.
 */
serve('health', () => ({
  ok: true,
  version: Deno.env.get('APP_VERSION') ?? 'dev',
  region: Deno.env.get('SB_REGION') ?? null,
  time: new Date().toISOString(),
}));
