import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { parseFxRates, toPoints, type FxRates } from './fx.ts';

const rates: FxRates = { rubToUzs: 135, usdToUzs: 12100 };

/**
 * Независимая от продакшн-кода разборка десятичной строки в дробь — чтобы
 * тест на согласованность `points`/`rate` не был просто копией
 * `decimalToFraction` из fx.ts и правда что-то проверял.
 */
function pointsFromRateString(amount: bigint, rate: string): bigint {
  const [intPart, fracPart = ''] = rate.split('.');
  const numerator = BigInt(intPart + fracPart);
  const denominator = 10n ** BigInt(fracPart.length);
  return (amount * numerator) / denominator;
}

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

// НАХОДКА 1 ревью: BigInt(rates.rubToUzs) падал на дробном курсе, потому что
// BigInt() требует целое. Сиды в миграции — плейсхолдеры, помечены
// «перепроверить перед запуском», реальный курс почти наверняка дробный.

Deno.test('дробный курс не падает и считается через точную дробь', () => {
  const fractional: FxRates = { rubToUzs: 148.62, usdToUzs: 12100 };
  // 1000 * 148.62 = 148620 ровно — делится без остатка, округление не участвует.
  assertEquals(toPoints(1000n, 'RUB', fractional), { points: 148620n, rate: '148.62' });
});

Deno.test('дробный курс округляет вниз, когда сумма не делится ровно', () => {
  const fractional: FxRates = { rubToUzs: 148.62, usdToUzs: 12100 };
  // 3 * 148.62 = 445.86 — floor обязан дать 445, а не 446 (не округлять в
  // пользу площадки) и не бросить.
  assertEquals(toPoints(3n, 'RUB', fractional), { points: 445n, rate: '148.62' });
});

Deno.test('курс с десятью знаками после запятой (предел numeric(20,10)) считается точно', () => {
  const precise: FxRates = { rubToUzs: 135, usdToUzs: 12100.1234567891 };
  assertEquals(toPoints(2n, 'USD', precise), { points: 24200n, rate: '12100.1234567891' });
});

Deno.test('points согласован с возвращённым rate — пересчёт по строке даёт то же число', () => {
  const fractional: FxRates = { rubToUzs: 148.62, usdToUzs: 12100.1234567891 };
  for (const [amount, currency] of [
    [1000n, 'RUB'],
    [3n, 'RUB'],
    [7n, 'USD'],
  ] as const) {
    const result = toPoints(amount, currency, fractional);
    assertEquals(result.points, pointsFromRateString(amount, result.rate));
  }
});

// НАХОДКА 2 ревью: fetchFxRates молча подставлял FALLBACK при отсутствующей
// строке конфига или отсутствующем ключе. parseFxRates — чистая часть
// fetchFxRates, вынесенная специально, чтобы эти пути проверялись без похода
// в базу.

Deno.test('parseFxRates бросает, если строки конфига нет', () => {
  assertThrows(() => parseFxRates(null), Error, 'app_config.fx_rates отсутствует');
});

Deno.test('parseFxRates бросает, если в строке не хватает ключа', () => {
  assertThrows(() => parseFxRates({ value: { rub_to_uzs: 148.62 } }), Error, 'usd_to_uzs');
  assertThrows(() => parseFxRates({ value: { usd_to_uzs: 12100 } }), Error, 'rub_to_uzs');
});

Deno.test('parseFxRates принимает полную строку конфига как есть', () => {
  assertEquals(parseFxRates({ value: { rub_to_uzs: 148.62, usd_to_uzs: 12100 } }), {
    rubToUzs: 148.62,
    usdToUzs: 12100,
  });
});
