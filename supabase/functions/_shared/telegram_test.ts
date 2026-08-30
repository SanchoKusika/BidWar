import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { verifyInitData } from './telegram.ts';

const BOT_TOKEN = 'test-token:AAAA';

/** Собирает подписанный initData так же, как это делает Telegram. */
async function signInitData(fields: Record<string, string>): Promise<string> {
  const params = new URLSearchParams(fields);
  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join('\n');

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secret = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(BOT_TOKEN));

  const signingKey = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(dataCheckString));
  const hash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  params.set('hash', hash);
  return params.toString();
}

const user = JSON.stringify({ id: 42, first_name: 'Test' });
const now = () => Math.floor(Date.now() / 1000);

Deno.test('валидный initData принимается и отдаёт пользователя', async () => {
  const initData = await signInitData({ user, auth_date: String(now()) });
  const result = await verifyInitData(initData, BOT_TOKEN);
  assertNotEquals(result, null);
  assertEquals(result?.user.id, 42);
});

Deno.test('подделанный initData отвергается', async () => {
  const initData = await signInitData({ user, auth_date: String(now()) });
  const forged = initData.replace(/first_name%22%3A%22Test/, 'first_name%22%3A%22Hack');
  assertEquals(await verifyInitData(forged, BOT_TOKEN), null);
});

Deno.test('initData без hash отвергается', async () => {
  assertEquals(await verifyInitData(`user=${encodeURIComponent(user)}`, BOT_TOKEN), null);
});

Deno.test('просроченный auth_date отвергается', async () => {
  const initData = await signInitData({ user, auth_date: String(now() - 60 * 60 * 25) });
  assertEquals(await verifyInitData(initData, BOT_TOKEN), null);
});
