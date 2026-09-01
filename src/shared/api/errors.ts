/**
 * Соединение оборвалось до ответа create-payment — неизвестно, успел ли
 * сервер применить платёж (находка I6 финального ревью). Отдельный класс, а
 * не просто текст сообщения: вызывающий код обязан показать другую
 * формулировку, а не «ничего не списано», и делать это по `instanceof`, а не
 * по совпадению строки. Живёт в shared/api, а не в features/raise: тем же
 * путём ходит Attack, а фича не импортирует соседнюю фичу.
 */
export class PaymentOutcomeUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentOutcomeUnknownError';
  }
}

/**
 * supabase-js даёт на неуспешный вызов Edge Function `FunctionsHttpError`, чьё
 * `.message` — всегда одна и та же общая строка ("Edge Function returned a
 * non-2xx status code"); настоящее сообщение (`{error:{message}}` из
 * `_shared/http.ts`) лежит в `.context` как сырой `Response`, и его нужно
 * читать отдельно — иначе понятная ошибка с бэкенда никогда не доходит
 * до пользователя (код-ревью PR #12).
 */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: { message?: string } };
        if (body.error?.message) return body.error.message;
      } catch {
        // Тело не JSON — остаёмся с fallback.
      }
    }
  }
  return fallback;
}

/**
 * true, если ответ Edge Function вообще не пришёл — supabase-js кладёт такую
 * ошибку в `FunctionsFetchError` (fetch() не смог достучаться: сеть
 * оборвалась, таймаут, DNS). Structural duck-typing по `.name`, а не
 * `instanceof`, — тем же способом, что и `functionErrorMessage` выше, без
 * прямой зависимости от класса supabase-js.
 *
 * Отличие от `FunctionsHttpError`/`FunctionsRelayError` принципиально для
 * платежей (находка I6 финального ревью): те означают «ответ получен, пусть
 * и с кодом ошибки» — сервер точно что-то решил и это решение нам известно.
 * `FunctionsFetchError` означает «неизвестно, что решил сервер»: create-payment
 * могла успеть применить платёж (списать и начислить очки) и оборваться уже
 * на отправке ответа. Это единственный случай, где нельзя говорить
 * «ничего не списано» — потому что мы этого не знаем.
 */
export function isPaymentOutcomeUnknown(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'FunctionsFetchError'
  );
}
