import { createMockProvider, type MockCommand } from './mock.ts';
import type { PaymentProvider } from './types.ts';

/**
 * Выбор провайдера конфигом, а не кодом: в этом весь смысл абстракции
 * (04 Платежи и валюты). Неизвестное значение — ошибка, а не молчаливый мок:
 * молчаливый мок в проде раздавал бы позиции бесплатно.
 *
 * Находка I9 финального ревью: НЕЗАДАННАЯ переменная раньше тоже молча
 * отдавала мок (`?? 'mock'`) — то есть настоящим рубежом между тестовым
 * контуром и боевым был не флаг `PREVIEW.mockPayments` (он красит только
 * список способов оплаты в `PaySheet`), а именно эта переменная окружения, и
 * её дефолт указывал в сторону мока. Дефолта больше нет: не задал —
 * функция не стартует, а не отдаёт бесплатные позиции.
 */
export function getProvider(command?: MockCommand): PaymentProvider {
  const id = Deno.env.get('PAYMENT_PROVIDER');
  if (id === undefined) {
    throw new Error('PAYMENT_PROVIDER не задан в окружении функции — мок не подставляется молча');
  }
  if (id === 'mock') return createMockProvider(command);
  throw new Error(`PAYMENT_PROVIDER=${id} не реализован (срез 1.10)`);
}

/** Команды мока принимаются только когда активен сам мок. */
export function mockCommandsAllowed(): boolean {
  return Deno.env.get('PAYMENT_PROVIDER') === 'mock';
}
