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
