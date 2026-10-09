import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { verifyTelegramIdToken, type Jwk } from './oidc.ts';
import { signLogin, verifyInitData } from './telegram.ts';

const BOT_ID = 8440994946;
const BOT_TOKEN = `${BOT_ID}:test-secret`;
const now = () => Math.floor(Date.now() / 1000);

function base64Url(bytes: Uint8Array | string): string {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let binary = '';
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A key pair standing in for Telegram's, and a signer of tokens with it. */
async function issuer(kid = 'test-key') {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk;
  const jwks = () => Promise.resolve({ keys: [{ ...publicJwk, kid, alg: 'RS256' }] });

  const sign = async (claims: Record<string, unknown>) => {
    const head = base64Url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
    const body = base64Url(JSON.stringify(claims));
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      pair.privateKey,
      new TextEncoder().encode(`${head}.${body}`),
    );
    return `${head}.${body}.${base64Url(new Uint8Array(signature))}`;
  };
  return { jwks, sign };
}

const claims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://oauth.telegram.org',
  aud: String(BOT_ID),
  sub: '1234123412341234123',
  iat: now(),
  exp: now() + 3600,
  id: 987654321,
  name: 'John Doe',
  given_name: 'John',
  family_name: 'Doe',
  preferred_username: 'johndoe',
  ...over,
});

Deno.test('ID-токен Telegram с верной подписью и нашим ботом принимается', async () => {
  const { jwks, sign } = await issuer();
  const verified = await verifyTelegramIdToken(await sign(claims()), BOT_ID, jwks);
  assertEquals(verified?.id, 987654321);
  assertEquals(verified?.preferred_username, 'johndoe');
});

Deno.test('токен, подписанный не Telegram, отвергается', async () => {
  const telegram = await issuer();
  const stranger = await issuer();
  const forged = await stranger.sign(claims());
  assertEquals(await verifyTelegramIdToken(forged, BOT_ID, telegram.jwks), null);
});

Deno.test('токен для чужого бота отвергается — aud обязан быть нашим', async () => {
  const { jwks, sign } = await issuer();
  const token = await sign(claims({ aud: '111111' }));
  assertEquals(await verifyTelegramIdToken(token, BOT_ID, jwks), null);
});

Deno.test('просроченный токен и чужой издатель отвергаются', async () => {
  const { jwks, sign } = await issuer();
  const expired = await sign(claims({ exp: now() - 3600 }));
  assertEquals(await verifyTelegramIdToken(expired, BOT_ID, jwks), null);
  const foreign = await sign(claims({ iss: 'https://evil.example' }));
  assertEquals(await verifyTelegramIdToken(foreign, BOT_ID, jwks), null);
});

Deno.test('испорченный токен — null, а не исключение', async () => {
  const { jwks } = await issuer();
  assertEquals(await verifyTelegramIdToken('not.a.token', BOT_ID, jwks), null);
  assertEquals(await verifyTelegramIdToken('garbage', BOT_ID, jwks), null);
});

Deno.test('выданный сервером вход проходит ту же проверку, что и все функции', async () => {
  const login = await signLogin(
    { id: '987654321', first_name: 'John', username: 'johndoe', auth_date: String(now()) },
    BOT_TOKEN,
  );
  const verified = await verifyInitData(login, BOT_TOKEN);
  assertNotEquals(verified, null);
  assertEquals(verified?.user.id, 987654321);
  // Minted with another bot's token it is worthless here.
  const foreign = await signLogin({ id: '1', first_name: 'X', auth_date: String(now()) }, '1:x');
  assertEquals(await verifyInitData(foreign, BOT_TOKEN), null);
});
