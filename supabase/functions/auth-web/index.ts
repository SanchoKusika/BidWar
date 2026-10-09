import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized } from '../_shared/http.ts';
import { botIdFromToken } from '../_shared/bot_api.ts';
import { verifyTelegramIdToken } from '../_shared/oidc.ts';
import { signLogin } from '../_shared/telegram.ts';

interface AuthWebRequest {
  idToken?: string;
}

/**
 * The site's sign-in: Telegram's OpenID popup gives the browser an ID token
 * that lives an hour. Checked here against Telegram's keys, it is exchanged
 * for the site's own thirty-day credential — the Login Widget format the
 * rest of the functions already verify (`_shared/telegram.ts`).
 *
 * Nothing is written here: the account is created or refreshed by `auth` on
 * the next request, exactly as for the mini app.
 */
serve('auth-web', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<AuthWebRequest>();
  if (typeof body.idToken !== 'string' || body.idToken.length === 0) {
    throw badRequest('idToken обязателен');
  }

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');
  const botId = botIdFromToken(botToken);
  if (!botId) throw new Error('BOT_TOKEN не похож на токен бота');

  const claims = await verifyTelegramIdToken(body.idToken, botId);
  if (!claims) throw unauthorized('Telegram не подтвердил вход');

  const firstName = claims.given_name || claims.name || claims.preferred_username || 'Telegram';
  const fields: Record<string, string> = {
    id: String(claims.id),
    first_name: firstName,
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  if (claims.family_name) fields.last_name = claims.family_name;
  if (claims.preferred_username) fields.username = claims.preferred_username;
  if (claims.picture) fields.photo_url = claims.picture;

  ctx.log('web sign-in', { telegramId: claims.id });
  return { login: await signLogin(fields, botToken) };
});
