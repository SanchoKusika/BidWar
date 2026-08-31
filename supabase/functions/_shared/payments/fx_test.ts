import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { toPoints, type FxRates } from './fx.ts';

const rates: FxRates = { rubToUzs: 135, usdToUzs: 12100 };

Deno.test('UZS конвертируется один к одному — якорь 1 очко = 1 сум', () => {
  assertEquals(toPoints(50000n, 'UZS', rates), { points: 50000n, rate: '1' });
});

Deno.test('рубли переводятся по курсу из конфига', () => {
  assertEquals(toPoints(1000n, 'RUB', rates), { points: 135000n, rate: '135' });
});

Deno.test('доллары переводятся по курсу из конфига', () => {
  assertEquals(toPoints(2n, 'USD', rates), { points: 24200n, rate: '12100' });
});

Deno.test('неизвестная валюта — ошибка, а не молчаливый курс 1', () => {
  assertThrows(() => toPoints(100n, 'EUR', rates), Error, 'EUR');
});

Deno.test('нулевая и отрицательная сумма отвергаются', () => {
  assertThrows(() => toPoints(0n, 'UZS', rates), Error);
  assertThrows(() => toPoints(-1n, 'UZS', rates), Error);
});
