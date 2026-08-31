import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { createMockProvider } from '../_shared/payments/mock.ts';

Deno.test('мок не принимает вебхуков — подтверждение приходит синхронно', async () => {
  const provider = createMockProvider();
  await assertRejects(
    () => provider.parseWebhook(new Request('https://example.com', { method: 'POST' })),
    Error,
    'не принимает вебхуков',
  );
});

Deno.test('неизвестный PAYMENT_PROVIDER не подменяется моком молча', async () => {
  const previous = Deno.env.get('PAYMENT_PROVIDER');
  Deno.env.set('PAYMENT_PROVIDER', 'globalpay');
  try {
    const { getProvider } = await import('../_shared/payments/registry.ts');
    let failed = false;
    try {
      getProvider();
    } catch {
      failed = true;
    }
    assertEquals(failed, true);
  } finally {
    if (previous === undefined) Deno.env.delete('PAYMENT_PROVIDER');
    else Deno.env.set('PAYMENT_PROVIDER', previous);
  }
});
