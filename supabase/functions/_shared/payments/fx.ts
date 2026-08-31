import { getAdminClient } from '../db.ts';

export interface FxRates {
  rubToUzs: number;
  usdToUzs: number;
}

/**
 * Курсы фиксированные и лежат в app_config: топ не должен дёргаться от
 * колебаний рынка, а внешняя зависимость в платёжном пути — лишняя точка отказа
 * (04 Платежи и валюты).
 *
 * Отсутствие строки конфига или нужного в ней ключа — явная ошибка, а не
 * молчаливая подстановка хардкода: app_config редактируется руками без
 * деплоя, опечатка оператора в имени ключа вероятна, а платёж, посчитанный по
 * забытому дефолту, никто не заметит без ручной сверки. Бросаем на весь
 * объект целиком (а не лениво по отдельному отсутствующему ключу): оба курса
 * живут в одной строке конфига, и её частичная поломка — сигнал, что конфиг
 * обновляли неаккуратно целиком, а не то, что один из курсов сейчас просто
 * не нужен. UZS этого пути вообще не касается — `toPoints` для UZS в `rates`
 * не заглядывает, так что вызывающая сторона может не звать `fetchFxRates`
 * для платежей в суммах вовсе и не пострадать от опечатки в RUB/USD.
 *
 * Разбор строки конфига вынесен в чистую `parseFxRates` отдельно от самого
 * похода в базу — так оба пути отказа (нет строки, битый ключ) проверяются
 * тестом напрямую, без похода к supabase-js.
 */
export function parseFxRates(row: { value: unknown } | null): FxRates {
  if (!row) throw new Error('app_config.fx_rates отсутствует — курс не из чего брать');

  const v = row.value as { rub_to_uzs?: unknown; usd_to_uzs?: unknown };
  if (typeof v.rub_to_uzs !== 'number') {
    throw new Error('app_config.fx_rates.rub_to_uzs отсутствует или не число');
  }
  if (typeof v.usd_to_uzs !== 'number') {
    throw new Error('app_config.fx_rates.usd_to_uzs отсутствует или не число');
  }

  return { rubToUzs: v.rub_to_uzs, usdToUzs: v.usd_to_uzs };
}

export async function fetchFxRates(): Promise<FxRates> {
  const { data, error } = await getAdminClient()
    .from('app_config')
    .select('value')
    .eq('key', 'fx_rates')
    .maybeSingle();

  if (error) throw error;
  return parseFxRates(data);
}

/**
 * Раскладывает JS-число на точную дробь numerator/denominator по его
 * канонической десятичной записи (`toString()` отдаёт кратчайшую строку,
 * которая парсится обратно в то же double, — то есть ровно то число, что
 * ввёл оператор в конфиге). Считать в bigint через саму дробь, а не через
 * `BigInt(value)`, обязательно: `BigInt()` требует целое и падает на любом
 * дробном курсе (148.62 и подобные — это не гипотеза, а плейсхолдер в сиде,
 * который прямо помечен «перепроверить перед запуском»).
 */
function decimalToFraction(value: number): { numerator: bigint; denominator: bigint } {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Курс должен быть положительным конечным числом: ${value}`);
  }
  const str = value.toString();
  if (str.includes('e') || str.includes('E')) {
    // Экспоненциальная запись у double появляется только на величинах, для
    // курса валют бессмысленных (< 1e-6 или ≥ 1e21) — считаем это ошибкой
    // конфига, а не пытаемся раскладывать мантиссу.
    throw new Error(`Курс в экспоненциальной записи не поддержан: ${value}`);
  }

  const [intPart = '0', fracPart = ''] = str.split('.');
  return {
    numerator: BigInt(intPart + fracPart),
    denominator: 10n ** BigInt(fracPart.length),
  };
}

/**
 * Якорь: 1 очко = 1 UZS, поэтому для основного рынка конвертация тождественна.
 * Возвращает и применённый курс — он пишется в payment_transactions.fx_rate_used
 * (numeric(20,10), под дробные курсы) и больше никогда не пересчитывается,
 * поэтому `rate` в ответе обязан быть ровно тем курсом, по которому реально
 * посчитан `points`, а не приближением.
 *
 * Округление — вниз (усечение целочисленного деления в bigint, для
 * положительных операндов это ровно floor): начислить пользователю меньше
 * очков, чем он оплатил, безопаснее для площадки, чем округлить в его
 * пользу и отдать позицию дороже её реальной оплаты.
 */
export function toPoints(
  amount: bigint,
  currency: string,
  rates: FxRates,
): { points: bigint; rate: string } {
  if (amount <= 0n) throw new Error(`Сумма должна быть положительной: ${amount}`);

  switch (currency) {
    case 'UZS':
      return { points: amount, rate: '1' };
    case 'RUB': {
      const { numerator, denominator } = decimalToFraction(rates.rubToUzs);
      return { points: (amount * numerator) / denominator, rate: rates.rubToUzs.toString() };
    }
    case 'USD': {
      const { numerator, denominator } = decimalToFraction(rates.usdToUzs);
      return { points: (amount * numerator) / denominator, rate: rates.usdToUzs.toString() };
    }
    default:
      throw new Error(`Неизвестная валюта: ${currency}`);
  }
}
