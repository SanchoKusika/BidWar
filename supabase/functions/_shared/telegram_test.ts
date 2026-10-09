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

/** Signs a Login Widget answer the way Telegram does: key = SHA-256 of the token. */
async function signLogin(fields: Record<string, string>): Promise<string> {
  const params = new URLSearchParams(fields);
  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join('\n');
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.digest('SHA-256', encoder.encode(BOT_TOKEN));
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataCheckString));
  params.set(
    'hash',
    Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  );
  return params.toString();
}

Deno.test('вход на сайте через Login Widget принимается и отдаёт пользователя', async () => {
  const login = await signLogin({
    id: '42',
    first_name: 'Test',
    username: 'tester',
    photo_url: 'https://t.me/i/userpic/320/x.jpg',
    auth_date: String(now()),
  });
  const result = await verifyInitData(login, BOT_TOKEN);
  assertEquals(result?.user.id, 42);
  assertEquals(result?.user.username, 'tester');
  assertEquals(result?.startParam, null, 'реферал на сайте не применяется');
});

Deno.test('подделанный вход на сайте отвергается', async () => {
  const login = await signLogin({ id: '42', first_name: 'Test', auth_date: String(now()) });
  assertEquals(await verifyInitData(login.replace('id=42', 'id=43'), BOT_TOKEN), null);
});

Deno.test('вход на сайте живёт тридцать дней, а не сутки', async () => {
  const day = 24 * 60 * 60;
  const week = await signLogin({ id: '42', first_name: 'T', auth_date: String(now() - 7 * day) });
  assertNotEquals(await verifyInitData(week, BOT_TOKEN), null);
  const old = await signLogin({ id: '42', first_name: 'T', auth_date: String(now() - 31 * day) });
  assertEquals(await verifyInitData(old, BOT_TOKEN), null);
});

Deno.test('подпись мини-аппа над полями сайта не проходит как вход на сайте', async () => {
  // Widget fields signed with the mini app's key must not verify, or the
  // 24-hour limit could be stretched to thirty days.
  const fields = { id: '42', first_name: 'Test', auth_date: String(now()) };
  assertEquals(await verifyInitData(await signInitData(fields), BOT_TOKEN), null);
});
