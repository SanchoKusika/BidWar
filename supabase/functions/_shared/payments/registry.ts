import { createMockProvider, type MockCommand } from './mock.ts';
import type { PaymentProvider } from './types.ts';

/**
 * Выбор провайдера конфигом, а не кодом: в этом весь смысл абстракции
 * (04 Платежи и валюты). Неизвестное значение — ошибка, а не молчаливый мок:
 * молчаливый мок в проде раздавал бы позиции бесплатно.
 */
export function getProvider(command?: MockCommand): PaymentProvider {
  const id = Deno.env.get('PAYMENT_PROVIDER') ?? 'mock';
  if (id === 'mock') return createMockProvider(command);
  throw new Error(`PAYMENT_PROVIDER=${id} не реализован (срез 1.10)`);
}

/** Команды мока принимаются только когда активен сам мок. */
export function mockCommandsAllowed(): boolean {
  return (Deno.env.get('PAYMENT_PROVIDER') ?? 'mock') === 'mock';
}
