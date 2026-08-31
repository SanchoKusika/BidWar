import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { parseRequest } from './validate.ts';

const base = { initData: 'x', amount: 50000 };

Deno.test('довзнос: достаточно projectId', () => {
  const parsed = parseRequest({ ...base, projectId: 7 });
  assertEquals(parsed.kind, 'topup');
  assertEquals(parsed.amount, 50000n);
});

Deno.test('открывающий вход: нужны категория и ссылка', () => {
  const parsed = parseRequest({ ...base, categoryId: 1, url: 'https://example.com' });
  assertEquals(parsed.kind, 'opening');
});

Deno.test('без projectId и без пары категория+ссылка — отказ', () => {
  assertThrows(() => parseRequest(base), Error, 'projectId');
});

Deno.test('нецелая или отрицательная сумма отвергается', () => {
  assertThrows(() => parseRequest({ ...base, amount: 1.5, projectId: 7 }), Error);
  assertThrows(() => parseRequest({ ...base, amount: -1, projectId: 7 }), Error);
});

Deno.test('ссылка не http(s) отвергается', () => {
  assertThrows(
    () => parseRequest({ ...base, categoryId: 1, url: 'javascript:alert(1)' }),
    Error,
    'http',
  );
});

Deno.test('минимум ставки берётся с сервера, а не из запроса', () => {
  assertThrows(() => parseRequest({ ...base, amount: 100, projectId: 7 }, 50000), Error, 'Минимум');
});
