import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { getProvider, mockCommandsAllowed } from './registry.ts';

const ENV_KEY = 'PAYMENT_PROVIDER';

/**
 * `deno test` гоняет все тестовые файлы в одном процессе, а переменные
 * окружения — общий для процесса ресурс. Без сохранения/восстановления
 * значение, выставленное здесь, потекло бы в остальные файлы.
 */
function withEnv(value: string | undefined, run: () => void): void {
  const prev = Deno.env.get(ENV_KEY);
  try {
    if (value === undefined) Deno.env.delete(ENV_KEY);
    else Deno.env.set(ENV_KEY, value);
    run();
  } finally {
    if (prev === undefined) Deno.env.delete(ENV_KEY);
    else Deno.env.set(ENV_KEY, prev);
  }
}

Deno.test('неизвестное значение PAYMENT_PROVIDER бросает, а не подставляет мок', () => {
  withEnv('globalpay', () => {
    assertThrows(() => getProvider(), Error, 'globalpay');
  });
});

// Находка I9 финального ревью: раньше `?? 'mock'` делал незаданную
// переменную неотличимой от `PAYMENT_PROVIDER=mock` — единственный настоящий
// рубеж между тестовым контуром и боевым молчал в сторону мока.
Deno.test('незаданная PAYMENT_PROVIDER бросает, а не молча отдаёт мок', () => {
  withEnv(undefined, () => {
    assertThrows(() => getProvider(), Error, 'PAYMENT_PROVIDER не задан');
  });
});

Deno.test('mockCommandsAllowed на незаданной переменной — false', () => {
  withEnv(undefined, () => {
    assertEquals(mockCommandsAllowed(), false);
  });
});

Deno.test('регистр важен — "Mock" не равен "mock"', () => {
  withEnv('Mock', () => {
    assertThrows(() => getProvider(), Error, 'Mock');
  });
});

Deno.test('пустая строка не эквивалентна отсутствующей переменной и тоже бросает', () => {
  withEnv('', () => {
    assertThrows(() => getProvider(), Error);
  });
});

Deno.test('PAYMENT_PROVIDER=mock отдаёт мок-провайдера', () => {
  withEnv('mock', () => {
    assertEquals(getProvider().id, 'mock');
  });
});

Deno.test('mockCommandsAllowed следует той же переменной, что и getProvider', () => {
  withEnv('globalpay', () => {
    assertEquals(mockCommandsAllowed(), false);
  });
  withEnv('mock', () => {
    assertEquals(mockCommandsAllowed(), true);
  });
});
