import { badRequest } from '../_shared/http.ts';

export interface CreatePaymentBody {
  initData?: string;
  amount?: number;
  projectId?: number;
  categoryId?: number;
  url?: string;
  mockCommand?: string;
}

export type ParsedRequest =
  | { kind: 'topup'; initData: string; amount: bigint; projectId: number }
  | { kind: 'opening'; initData: string; amount: bigint; categoryId: number; url: string };

const MAX_URL_LENGTH = 2048;

/**
 * Чистые правила запроса — без сети и без базы, поэтому тестируются отдельно.
 * Минимум ставки приходит вторым аргументом из app_config: в клиенте его нет,
 * и расхождение здесь стоило бы денег.
 */
export function parseRequest(body: CreatePaymentBody, minPaidAmount?: number): ParsedRequest {
  if (!body.initData) throw badRequest('initData обязателен');

  const amount = body.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw badRequest('Сумма должна быть целым положительным числом');
  }
  if (minPaidAmount !== undefined && amount < minPaidAmount) {
    throw badRequest(`Минимум ставки — ${minPaidAmount}`);
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
  if (body.url.length > MAX_URL_LENGTH) throw badRequest('Ссылка слишком длинная');

  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    throw badRequest('Ссылка не распознана');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw badRequest('Ссылка должна быть http(s)');
  }

  return {
    kind: 'opening',
    initData: body.initData,
    amount: BigInt(amount),
    categoryId: body.categoryId!,
    url: parsed.toString(),
  };
}
