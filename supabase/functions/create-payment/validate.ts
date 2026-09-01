import { badRequest } from '../_shared/http.ts';
import { parseHttpUrl } from '../_shared/url.ts';

export interface CreatePaymentBody {
  initData?: string;
  amount?: number;
  projectId?: number;
  categoryId?: number;
  url?: string;
  /** Атака: по кому бьём. Свой проект сервер находит сам, его не передают. */
  targetProjectId?: number;
  mockCommand?: string;
}

export type ParsedRequest =
  | { kind: 'topup'; initData: string; amount: bigint; projectId: number }
  | { kind: 'opening'; initData: string; amount: bigint; categoryId: number; url: string }
  | { kind: 'attack'; initData: string; amount: bigint; targetProjectId: number };

// Не бизнес-правило (то — устройство минимума, см. assertMinPaidAmount), а
// граница здравого смысла для типов: без неё '1e20' проходит Number.isInteger
// (дробная часть double на такой величине не отличима от нуля) и BigInt(amount)
// её молча принимает, а дальше вставка в bigint-колонку валится переполнением
// (500 вместо 400) — причём для открывающего входа к этому моменту уже
// заведена строка pending_payment. Запас с огромным множителем: заведомо выше
// любой мыслимой ставки, но заметно ниже Number.MAX_SAFE_INTEGER (2^53−1) и
// границы Postgres bigint, так что точность amount как Number не теряется.
const MAX_AMOUNT = 1_000_000_000_000; // 1e12

/**
 * Чистые правила запроса — без сети и без базы, поэтому тестируются отдельно.
 * Здесь только то, что не зависит от конфига: типы, целостность, синтаксис
 * URL. Сравнение с минимумом ставки читает app_config и обязано идти уже
 * ПОСЛЕ verifyInitData (иначе неаутентифицированный запрос успевал бы дёрнуть
 * чтение конфига раньше проверки подписи) — оно вынесено в assertMinPaidAmount
 * и вызывается отдельно в index.ts.
 */
export function parseRequest(body: CreatePaymentBody): ParsedRequest {
  if (!body.initData) throw badRequest('initData обязателен');

  const amount = body.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw badRequest('Сумма должна быть целым положительным числом');
  }
  if (amount > MAX_AMOUNT) {
    throw badRequest(`Сумма превышает допустимый предел — ${MAX_AMOUNT}`);
  }

  // Атака проверяется первой и требует, чтобы своего projectId в запросе НЕ
  // было: атакующая запись определяется сервером по подписанному initData.
  // Принять её от клиента значило бы разрешить бить в чужую пользу.
  if (Number.isInteger(body.targetProjectId)) {
    if (body.projectId !== undefined || body.url !== undefined) {
      throw badRequest('Для атаки нужен только targetProjectId');
    }
    return {
      kind: 'attack',
      initData: body.initData,
      amount: BigInt(amount),
      targetProjectId: body.targetProjectId!,
    };
  }

  if (Number.isInteger(body.projectId)) {
    return {
      kind: 'topup',
      initData: body.initData,
      amount: BigInt(amount),
      projectId: body.projectId!,
    };
  }

  if (!Number.isInteger(body.categoryId) || !body.url) {
    throw badRequest('Нужен либо projectId, либо пара categoryId + url');
  }

  // parseHttpUrl сама подставляет https://, если протокол не указан — см.
  // комментарий в _shared/url.ts (общая точка для этого и add-project).
  const parsed = parseHttpUrl(body.url);

  return {
    kind: 'opening',
    initData: body.initData,
    amount: BigInt(amount),
    categoryId: body.categoryId!,
    url: parsed.toString(),
  };
}

/**
 * Минимум ставки — бизнес-правило с сервера (app_config.paid_limits): в
 * клиенте его нет, и расхождение здесь стоило бы денег (CLAUDE.md). Отдельная
 * функция, а не параметр parseRequest: минимум читается из базы уже после
 * verifyInitData, а сам parseRequest — чистый и бесплатный, ему база не нужна.
 */
export function assertMinPaidAmount(amount: bigint, minPaidAmount: number): void {
  if (amount < BigInt(minPaidAmount)) {
    throw badRequest(`Минимум ставки — ${minPaidAmount}`);
  }
}

export interface PaidLimits {
  minPaidAmount: number;
}

/**
 * Строку app_config.paid_limits проверяет .single() у вызывающего — она уже
 * бросает, если строки нет вообще. Но частичная порча ключа внутри JSON
 * (переименовали, опечатались при ручной правке конфига) — другая ошибка:
 * `.min_paid_amount ?? 50000` тихо подставлял бы хардкод вместо отказа. Это
 * ровно та мина, которую убрали из fetchFxRates (b0135cc) — воспроизведённая
 * здесь по недосмотру и починенная тем же способом: отсутствие ключа или
 * нечисловое/неположительное значение — явная ошибка, а не молчаливый дефолт.
 */
export function parsePaidLimits(value: unknown): PaidLimits {
  const v = value as { min_paid_amount?: unknown };
  if (
    typeof v.min_paid_amount !== 'number' ||
    !Number.isFinite(v.min_paid_amount) ||
    v.min_paid_amount <= 0
  ) {
    throw new Error(
      'app_config.paid_limits.min_paid_amount отсутствует, не число или не положительно',
    );
  }
  return { minPaidAmount: v.min_paid_amount };
}
