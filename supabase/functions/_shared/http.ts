/**
 * Общая обвязка Edge Functions: CORS, единый формат ответа и ошибки,
 * структурный лог с идентификатором запроса.
 *
 * Каждая следующая функция начинается со `serve('имя', handler)` — чтобы
 * формат ошибки и поля лога не расходились от функции к функции.
 */

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
};

/** Ошибка, которую можно показать клиенту: код и сообщение уходят в ответ. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, meta?: Record<string, unknown>) =>
  new HttpError(400, 'bad_request', message, meta);

export const unauthorized = (message = 'Требуется авторизация') =>
  new HttpError(401, 'unauthorized', message);

export const notFound = (message = 'Не найдено') => new HttpError(404, 'not_found', message);

export interface RequestContext {
  /** Уходит в ответ заголовком `x-request-id` и в каждую строку лога. */
  readonly requestId: string;
  readonly url: URL;
  /** Разбор JSON-тела с внятной ошибкой вместо SyntaxError. */
  body<T>(): Promise<T>;
  log(message: string, fields?: Record<string, unknown>): void;
}

type Handler = (req: Request, ctx: RequestContext) => Promise<unknown> | unknown;

export function serve(name: string, handler: Handler): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    const url = new URL(req.url);

    const ctx: RequestContext = {
      requestId,
      url,
      async body<T>(): Promise<T> {
        try {
          return (await req.json()) as T;
        } catch {
          throw badRequest('Тело запроса не разобралось как JSON');
        }
      },
      log(message, fields) {
        write(name, requestId, 'info', { message, ...fields });
      },
    };

    try {
      const result = await handler(req, ctx);
      const response = result instanceof Response ? result : json(result, 200);
      write(name, requestId, 'info', {
        method: req.method,
        path: url.pathname,
        status: response.status,
        ms: Math.round(performance.now() - startedAt),
      });
      return withHeaders(response, requestId);
    } catch (error) {
      const failure =
        error instanceof HttpError
          ? error
          : new HttpError(500, 'internal_error', 'Внутренняя ошибка');

      write(name, requestId, failure.status >= 500 ? 'error' : 'warn', {
        method: req.method,
        path: url.pathname,
        status: failure.status,
        code: failure.code,
        // Наружу уходит только код и сообщение HttpError, meta и стек остаются
        // в логе — meta может нести что угодно, вплоть до чувствительных
        // значений, которые вызывающий передал для отладки.
        meta: failure.meta,
        detail: serializeError(error),
        ms: Math.round(performance.now() - startedAt),
      });

      return withHeaders(
        json(
          { error: { code: failure.code, message: failure.message, requestId } },
          failure.status,
        ),
        requestId,
      );
    }
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function withHeaders(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  headers.set('x-request-id', requestId);
  return new Response(response.body, { status: response.status, headers });
}

// PostgrestError и подобные несут code/details/hint поверх Error — обычный
// error.stack их теряет, а именно они обычно и объясняют, что случилось.
function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    const extra: Record<string, unknown> = {};
    for (const key of ['code', 'details', 'hint'] as const) {
      if (key in error) extra[key] = (error as Record<string, unknown>)[key];
    }
    return { message: error.message, stack: error.stack, ...extra };
  }
  return String(error);
}

type Level = 'info' | 'warn' | 'error';

function write(fn: string, requestId: string, level: Level, fields: Record<string, unknown>): void {
  // Одна строка JSON: так логи Supabase фильтруются по fn и requestId.
  // Метод консоли выбирается по уровню намеренно: severity в логах Supabase
  // берётся из него, а не из поля внутри сообщения, — иначе пятисотки
  // осядут в логе как info и алерты на них не сработают.
  const line = JSON.stringify({ level, fn, requestId, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
