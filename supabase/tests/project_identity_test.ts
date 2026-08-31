import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. план, задача 2');

/**
 * Каждый тест целиком внутри транзакции, которая всегда откатывается: база
 * общая с разработкой, и оставлять в ней мусор нельзя. Та же обвязка, что в
 * apply_payment_test.ts — не выносим в общий модуль ради одного файла.
 */
async function inRollback(fn: (sql: postgres.TransactionSql) => Promise<void>): Promise<void> {
  const sql = postgres(url!, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Error('__rollback__');
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== '__rollback__') throw error;
  } finally {
    await sql.end();
  }
}

async function seedProject(
  tx: postgres.TransactionSql,
  status: 'pending_payment' | 'active',
  categoryId: number,
) {
  const [user] = await tx`
    insert into users (display_name) values ('test-identity') returning id`;
  const [project] = await tx`
    insert into projects (user_id, category_id, name, url, type, status)
    values (${user.id}, ${categoryId}, 'T', ${'https://identity.example/' + crypto.randomUUID()},
            'paid', ${status})
    returning id`;
  return { userId: user.id, projectId: project.id };
}

// Находка C2 финального ревью: create-payment переиспользует брошенную
// pending_payment-строку, обновляя в т.ч. category_id (спека
// «Брошенные оплаты»). Триггер forbid_project_identity_change был написан
// для активных проектов, но буквально запрещал менять category_id для
// ЛЮБОЙ строки — переиспользование с другой категорией роняло UPDATE в
// check_violation и запирало слот навсегда (строку нельзя ни удалить —
// на неё ссылается payment_transactions, — ни вставить новую поверх —
// unique-индекс на pending_payment).
Deno.test(
  'category_id можно сменить, пока проект ещё ни разу не был active (pending_payment)',
  async () => {
    await inRollback(async (tx) => {
      const [categoryA, categoryB] =
        await tx`select id from categories order by sort_order limit 2`;
      const { projectId } = await seedProject(tx, 'pending_payment', categoryA.id);

      await tx`update projects set category_id = ${categoryB.id} where id = ${projectId}`;

      const [after] = await tx`select category_id, status from projects where id = ${projectId}`;
      assertEquals(after.category_id, categoryB.id);
      assertEquals(
        after.status,
        'pending_payment',
        'смена категории сама по себе не активирует строку',
      );
    });
  },
);

Deno.test('category_id по-прежнему неизменяем, как только проект стал active', async () => {
  await inRollback(async (tx) => {
    const [categoryA, categoryB] = await tx`select id from categories order by sort_order limit 2`;
    const { projectId } = await seedProject(tx, 'active', categoryA.id);

    await assertRejects(
      () => tx`update projects set category_id = ${categoryB.id} where id = ${projectId}`,
      Error,
      'category_id',
      'инвариант «нельзя перевести живой проект в чужую категорию» обязан держаться',
    );
  });
});

Deno.test('type по-прежнему неизменяем, как только проект стал active', async () => {
  await inRollback(async (tx) => {
    const [category] = await tx`select id from categories order by sort_order limit 1`;
    const { projectId } = await seedProject(tx, 'active', category.id);

    await assertRejects(
      () => tx`update projects set type = 'free' where id = ${projectId}`,
      Error,
      'type',
    );
  });
});

// Собственно сценарий C2: create-payment находит брошенную pending_payment
// строку пользователя и обновляет её ссылку + категорию — именно так, как
// делает сама функция, только напрямую SQL (edge function здесь не
// поднимается, но это тот же UPDATE, что она выполняет).
Deno.test(
  'брошенную pending_payment-строку можно переиспользовать под другую категорию и адрес',
  async () => {
    await inRollback(async (tx) => {
      const [categoryA, categoryB] =
        await tx`select id from categories order by sort_order limit 2`;
      const { projectId } = await seedProject(tx, 'pending_payment', categoryA.id);
      const newUrl = 'https://identity-reused.example/' + crypto.randomUUID();

      await tx`
      update projects
         set category_id = ${categoryB.id}, url = ${newUrl}, name = 'Reused'
       where id = ${projectId} and status = 'pending_payment'`;

      const [after] = await tx`select category_id, url, name from projects where id = ${projectId}`;
      assertEquals(after.category_id, categoryB.id);
      assertEquals(after.url, newUrl);
      assertEquals(after.name, 'Reused');
    });
  },
);
