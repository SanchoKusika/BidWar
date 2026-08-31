import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { normalizeUrl, parseHttpUrl } from './url.ts';

Deno.test('normalizeUrl: ссылка без схемы получает https://', () => {
  assertEquals(normalizeUrl('t.me/channel'), 'https://t.me/channel');
  assertEquals(normalizeUrl('instagram.com/user'), 'https://instagram.com/user');
});

Deno.test('normalizeUrl: обрезает пробелы по краям перед проверкой схемы', () => {
  assertEquals(normalizeUrl('  t.me/channel  '), 'https://t.me/channel');
});

Deno.test('normalizeUrl: ссылка с http:// или https:// не трогается', () => {
  assertEquals(normalizeUrl('https://t.me/channel'), 'https://t.me/channel');
  assertEquals(normalizeUrl('http://example.com'), 'http://example.com');
});

Deno.test('normalizeUrl: посторонняя схема тоже не трогается (не наш случай, но не ломаем)', () => {
  assertEquals(normalizeUrl('javascript:alert(1)'), 'javascript:alert(1)');
});

Deno.test('parseHttpUrl: ссылка без протокола распознаётся как https', () => {
  const url = parseHttpUrl('t.me/telegram');
  assertEquals(url.protocol, 'https:');
  assertEquals(url.hostname, 't.me');
  assertEquals(url.pathname, '/telegram');
});

Deno.test('parseHttpUrl: ссылка с уже указанным http:// не трогается', () => {
  const url = parseHttpUrl('http://example.com/path');
  assertEquals(url.protocol, 'http:');
});

// НАХОДКА этого захода: `new URL(raw)` на строке без протокола («t.me/channel»)
// бросает сама по себе — раньше это заваливало ЛЮБУЮ ссылку без явного
// http(s):// с «Ссылка не распознана» ещё до похода за OG-превью.
Deno.test('parseHttpUrl: реально бессмысленный ввод по-прежнему отвергается', () => {
  assertThrows(() => parseHttpUrl(''), Error, 'не распознана');
  assertThrows(() => parseHttpUrl('   '), Error, 'не распознана');
});

Deno.test(
  'parseHttpUrl: посторонняя схема отвергается как «не http(s)», а не как «не распознана»',
  () => {
    assertThrows(() => parseHttpUrl('javascript:alert(1)'), Error, 'http');
  },
);

Deno.test('parseHttpUrl: ссылка длиннее лимита отвергается до парсинга', () => {
  const long = 'https://example.com/' + 'a'.repeat(3000);
  assertThrows(() => parseHttpUrl(long), Error, 'длинная');
});

Deno.test('parseHttpUrl: свой лимит длины можно передать параметром', () => {
  assertThrows(() => parseHttpUrl('https://example.com/abc', 10), Error, 'длинная');
});
