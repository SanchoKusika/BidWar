import { assertEquals } from 'jsr:@std/assert@1';
import { botIdFromToken, channelUsername, isPermanent } from './bot_api.ts';

Deno.test('botIdFromToken: id — это часть токена до двоеточия', () => {
  assertEquals(botIdFromToken('8440994946:AAGR0uvD3ZUZuY1hm0GPVzW8KTv'), 8440994946);
});

Deno.test('botIdFromToken: мусор вместо токена не даёт id', () => {
  for (const token of ['', 'нет-двоеточия', ':AAGR', 'abc:AAGR', '-5:AAGR', '0:AAGR']) {
    assertEquals(botIdFromToken(token), null, token);
  }
});

Deno.test('channelUsername: обычная ссылка на канал', () => {
  assertEquals(channelUsername('https://t.me/durov'), 'durov');
  assertEquals(channelUsername('https://t.me/durov/'), 'durov');
  assertEquals(channelUsername('https://www.t.me/durov'), 'durov');
  assertEquals(channelUsername('https://t.me/durov/123'), 'durov');
});

// Приглашения в закрытый чат: getChat по ним не работает, и отсеивать их надо
// здесь, а не получать невнятный отказ Bot API.
Deno.test('channelUsername: приглашения в закрытый чат отсеиваются', () => {
  assertEquals(channelUsername('https://t.me/+AbCdEfGhIjK'), null);
  assertEquals(channelUsername('https://t.me/joinchat/AbCdEfGhIjK'), null);
});

Deno.test('channelUsername: не telegram и битые ссылки', () => {
  assertEquals(channelUsername('https://example.com/durov'), null);
  assertEquals(channelUsername('https://telegram.me/durov'), null);
  assertEquals(channelUsername('t.me/durov'), null, 'без схемы URL не разбирается');
  assertEquals(channelUsername('https://t.me/'), null);
  assertEquals(channelUsername('не ссылка'), null);
});

// Юзернеймы Telegram — 5..32 символа из букв, цифр и подчёркиваний.
Deno.test('channelUsername: слишком короткое имя не юзернейм', () => {
  assertEquals(channelUsername('https://t.me/abcd'), null);
  assertEquals(channelUsername('https://t.me/abcde'), 'abcde');
});

// ---------------------------------------------------------------------------
// Какой отказ Telegram считать окончательным (находка ревью 1.9)
// ---------------------------------------------------------------------------

Deno.test('403 — окончательный отказ: человек не начинал диалог или заблокировал бота', () => {
  assertEquals(isPermanent(403, 'Forbidden: bot was blocked by the user'), true);
});

Deno.test('400 про самого адресата — тоже окончательный', () => {
  assertEquals(isPermanent(400, 'Bad Request: chat not found'), true);
  assertEquals(isPermanent(400, 'Bad Request: user not found'), true);
});

Deno.test('остальные 400 повторяются: иначе опечатка в APP_URL хоронит всю очередь', () => {
  // BUTTON_TYPE_INVALID приходит, когда домен мини-аппа настроен неверно. Это
  // общая ошибка конфигурации, а не свойство адресата: считать её
  // окончательной значит потерять ВСЕ уведомления всех людей разом, и после
  // починки чинить будет уже нечего.
  assertEquals(isPermanent(400, 'Bad Request: BUTTON_TYPE_INVALID'), false);
  assertEquals(isPermanent(429, 'Too Many Requests: retry after 30'), false);
  assertEquals(isPermanent(500, 'Internal Server Error'), false);
  assertEquals(isPermanent(undefined, undefined), false);
});
