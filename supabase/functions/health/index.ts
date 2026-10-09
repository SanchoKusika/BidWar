import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from '../_shared/http.ts';
import { botIdFromToken } from '../_shared/bot_api.ts';

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
  // The site's sign-in button needs the bot the server verifies against. The
  // id is the public half of the token; serving it from here keeps the site
  // from ever naming a different bot than the one that checks the signature.
  botId: botIdFromToken(Deno.env.get('BOT_TOKEN') ?? ''),
}));
