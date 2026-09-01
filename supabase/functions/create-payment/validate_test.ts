import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { parseRequest, assertMinPaidAmount, parsePaidLimits } from './validate.ts';

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

Deno.test('атака: достаточно targetProjectId', () => {
  const parsed = parseRequest({ ...base, amount: 10000, targetProjectId: 9 });
  assertEquals(parsed.kind, 'attack');
  assertEquals(parsed.amount, 10000n);
});

// Атакующую запись сервер берёт из подписанного initData. Принять её от
// клиента значило бы разрешить бить, начисляя очки чужому проекту.
Deno.test('атака: свой projectId в теле запроса отвергается', () => {
  assertThrows(
    () => parseRequest({ ...base, targetProjectId: 9, projectId: 3 }),
    Error,
    'только targetProjectId',
  );
});

Deno.test('атака: ссылка в теле запроса отвергается', () => {
  assertThrows(
    () => parseRequest({ ...base, targetProjectId: 9, url: 'https://example.com' }),
    Error,
    'только targetProjectId',
  );
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

// НАХОДКА 4 ревью: 1e20 проходил Number.isInteger (дробная часть double на
// такой величине неразличима) и BigInt(amount) её молча принимал — падало уже
// на вставке в bigint-колонку переполнением (500 вместо 400), причём для
// открывающего входа строка pending_payment к этому моменту уже заведена.
Deno.test('сумма выше верхнего предела отвергается, а не падает переполнением на вставке', () => {
  assertThrows(() => parseRequest({ ...base, amount: 1e20, projectId: 7 }), Error, 'предел');
  assertThrows(
    () => parseRequest({ ...base, amount: 10_000_000_000_000, projectId: 7 }),
    Error,
    'предел',
  );
});

// НАХОДКА 2 ревью: минимум ставки больше не параметр parseRequest — он должен
// проверяться уже после verifyInitData, отдельной функцией.
Deno.test('assertMinPaidAmount: сумма ниже минимума отвергается', () => {
  const parsed = parseRequest({ ...base, amount: 100, projectId: 7 });
  assertThrows(() => assertMinPaidAmount(parsed.amount, 50000), Error, 'Минимум');
});

Deno.test('assertMinPaidAmount: сумма не ниже минимума проходит', () => {
  const parsed = parseRequest({ ...base, projectId: 7 });
  assertMinPaidAmount(parsed.amount, 50000);
});

// НАХОДКА 1 ревью: `.min_paid_amount ?? 50000` тихо подставлял хардкод, если
// ключ в JSON-строке конфига отсутствовал или был испорчен, — та же мина, что
// была в fetchFxRates до b0135cc.
Deno.test('parsePaidLimits: ключ отсутствует — явная ошибка', () => {
  assertThrows(() => parsePaidLimits({}), Error, 'min_paid_amount');
});

Deno.test('parsePaidLimits: значение не число — явная ошибка', () => {
  assertThrows(() => parsePaidLimits({ min_paid_amount: '50000' }), Error, 'min_paid_amount');
});

Deno.test('parsePaidLimits: ноль и отрицательное значение отвергаются', () => {
  assertThrows(() => parsePaidLimits({ min_paid_amount: 0 }), Error, 'min_paid_amount');
  assertThrows(() => parsePaidLimits({ min_paid_amount: -1 }), Error, 'min_paid_amount');
});

Deno.test('parsePaidLimits: корректное значение принимается как есть', () => {
  assertEquals(parsePaidLimits({ min_paid_amount: 50000 }), { minPaidAmount: 50000 });
});
