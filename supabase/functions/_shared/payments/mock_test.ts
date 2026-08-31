import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { createMockProvider } from './mock.ts';
import type { ApplyResult } from './apply.ts';

const BASE_INPUT = {
  paymentId: 'pay-1',
  userId: 'user-1',
  intent: 'raise' as const,
  projectId: 42,
  amount: 100000n,
};

/** Хранимка вызывается один раз, значит — фиксированный ответ на каждый вызов. */
function applyOnce(result: ApplyResult) {
  let calls = 0;
  const apply = (_paymentId: string, _eventId: string, _confirmed: boolean) => {
    calls += 1;
    return Promise.resolve(result);
  };
  return { apply, callCount: () => calls };
}

// Находка C1 финального ревью: сценарий — двое одновременно оплачивают вход
// с одним URL, apply_payment одному из них честно отвечает applied = false
// (проиграл гонку за unique-индекс), но вызывающий провайдер попросил
// confirmed = true. Мок обязан отразить именно то, что вернула хранимка, а
// не то, что сам попросил.
Deno.test(
  'applied = false из хранимки даёт status "failed", даже когда провайдер просил confirmed = true',
  async () => {
    const { apply } = applyOnce({ applied: false, projectId: 42, pointsGranted: 0 });
    const provider = createMockProvider(undefined, apply);

    const result = await provider.createPayment(BASE_INPUT);

    assertEquals(result.status, 'failed', 'applied: false обязан давать failed, а не confirmed');
    assertEquals(result.pointsGranted, 0);
  },
);

Deno.test('applied = true из хранимки даёт status "confirmed"', async () => {
  const { apply } = applyOnce({ applied: true, projectId: 42, pointsGranted: 100000 });
  const provider = createMockProvider(undefined, apply);

  const result = await provider.createPayment(BASE_INPUT);

  assertEquals(result.status, 'confirmed');
  assertEquals(result.pointsGranted, 100000);
});

Deno.test('command "decline" просит confirmed = false у хранимки', async () => {
  let seenConfirmed: boolean | undefined;
  const apply = (_paymentId: string, _eventId: string, confirmed: boolean) => {
    seenConfirmed = confirmed;
    return Promise.resolve<ApplyResult>({ applied: false, projectId: 42, pointsGranted: 0 });
  };
  const provider = createMockProvider('decline', apply);

  const result = await provider.createPayment(BASE_INPUT);

  assertEquals(seenConfirmed, false);
  assertEquals(result.status, 'failed');
});

Deno.test('command "duplicate" вызывает apply дважды и берёт исход первого вызова', async () => {
  const calls: boolean[] = [];
  let call = 0;
  const apply = (_paymentId: string, _eventId: string, confirmed: boolean) => {
    calls.push(confirmed);
    call += 1;
    // Первый вызов проходит, второй (повторный вебхук) — идемпотентный no-op.
    return Promise.resolve<ApplyResult>(
      call === 1
        ? { applied: true, projectId: 42, pointsGranted: 100000 }
        : { applied: false, projectId: 42, pointsGranted: 0 },
    );
  };
  const provider = createMockProvider('duplicate', apply);

  const result = await provider.createPayment(BASE_INPUT);

  assertEquals(calls.length, 2, 'apply обязан быть вызван дважды');
  assertEquals(result.status, 'confirmed', 'ответ клиенту берётся из первого вызова, не второго');
  assertEquals(result.pointsGranted, 100000);
});

Deno.test('command "stuck_pending" не зовёт хранимку вообще', async () => {
  let called = false;
  const apply = () => {
    called = true;
    return Promise.resolve<ApplyResult>({ applied: true, projectId: 42, pointsGranted: 100000 });
  };
  const provider = createMockProvider('stuck_pending', apply);

  const result = await provider.createPayment(BASE_INPUT);

  assertEquals(called, false);
  assertEquals(result.status, 'pending');
  assertEquals(result.openUrl, null);
});

Deno.test('parseWebhook мока всегда отклоняется — у него нет внешней стороны', async () => {
  const provider = createMockProvider();
  await assertRejects(() => provider.parseWebhook(new Request('https://example.test')));
});
