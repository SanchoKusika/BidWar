import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { toPoints } from './fx.ts';

Deno.test('рубли конвертируются один к одному — якорь 1 очко = 1 ₽', () => {
  assertEquals(toPoints(300n, 'RUB'), { points: 300n, rate: '1' });
});

Deno.test('чужая валюта — ошибка, а не молчаливый курс 1', () => {
  assertThrows(() => toPoints(50000n, 'UZS'), Error, 'UZS');
  assertThrows(() => toPoints(100n, 'USD'), Error, 'USD');
});

Deno.test('нулевая и отрицательная сумма отвергаются', () => {
  assertThrows(() => toPoints(0n, 'RUB'), Error);
  assertThrows(() => toPoints(-1n, 'RUB'), Error);
});
