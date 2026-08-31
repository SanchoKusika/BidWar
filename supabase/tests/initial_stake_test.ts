import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. план, задача 2');

// Находка I8 финального ревью: у сидовых платных проектов initial_stake был
// NULL. apply_payment фиксирует его правилом
// `coalesce(initial_stake, points_granted)` — то есть ПЕРВЫМ довзносом, а не
// уже накопленной ставкой. Без бэкфилла (миграция
// 20260831130000_backfill_initial_stake) первый же Raise на такой проект
// зафиксировал бы initial_stake равным одной этой прибавке, и floor (1.6)
// позволил бы обвалить проект почти до нуля вместо честной половины реальной
// ставки. Это не тест хранимки — прямая проверка данных против живой базы,
// без rollback: SELECT ничего не меняет, а состояние NULL/не-NULL после
// миграции обязано стать инвариантом, а не разовым фактом.
Deno.test('активные платные проекты со ставкой не остаются без initial_stake', async () => {
  const sql = postgres(url!, { max: 1, prepare: false });
  try {
    const rows = await sql`
      select id, paid_amount from projects
       where type = 'paid' and status = 'active' and paid_amount > 0 and initial_stake is null`;
    assertEquals(
      rows.length,
      0,
      `бэкфилл initial_stake (находка I8) не покрыл строки: ${rows.map((r) => r.id).join(', ')}`,
    );
  } finally {
    await sql.end();
  }
});
