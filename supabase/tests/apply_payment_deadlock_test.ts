import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. план, задача 2');

/**
 * Долг среза 1.5, закрываемый в 1.6 (08 План разработки).
 *
 * `apply_payment` блокирует строки `projects` по возрастанию `id`. До Attack
 * такой тест был невозможен: правило защищает только когда обе стороны ему
 * следуют, а второй стороны — транзакции с пересекающимся набором строк в
 * обратном порядке — в продукте не существовало. Attack её создаёт: «A бьёт
 * B» и «B бьёт A» трогают одни и те же две строки, и если бы функция брала их
 * в порядке «сначала своя, потом цель», встречная пара давала бы дедлок
 * гарантированно.
 *
 * Тест по необходимости вероятностный: паузу внутрь одного SQL-statement'а не
 * вставить, поэтому взаимное перекрытие достигается повторами. Отсюда второй
 * тест — контрольный: он берёт те же две строки заведомо в обратном порядке и
 * ОБЯЗАН словить 40P01. Без него первый тест ничего не доказывает — он
 * зеленел бы и на стенде, где дедлок в принципе не воспроизводится.
 *
 * В отличие от остальных файлов в этой папке транзакцией не обойтись:
 * встречные блокировки требуют разных соединений, а разные соединения не
 * видят чужую незакоммиченную транзакцию. Поэтому строки создаются
 * по-настоящему и убираются в finally.
 */

const PAIRS = 15;
const STAKE = 10_000_000;
const ATTACK = 10_000;

interface Fixture {
  userA: string;
  userB: string;
  projectA: number;
  projectB: number;
}

async function seed(sql: postgres.Sql): Promise<Fixture> {
  const [category] = await sql`select id from categories order by sort_order limit 1`;
  const [a] = await sql`insert into users (display_name) values ('deadlock-a') returning id`;
  const [b] = await sql`insert into users (display_name) values ('deadlock-b') returning id`;

  const make = async (userId: string) => {
    const [row] = await sql`
      insert into projects (user_id, category_id, name, url, type, status, paid_amount, initial_stake)
      values (${userId}, ${category.id}, 'deadlock',
              ${'https://deadlock.test/' + crypto.randomUUID()},
              'paid', 'active', ${STAKE}, ${STAKE})
      returning id`;
    return Number(row.id);
  };

  return { userA: a.id, userB: b.id, projectA: await make(a.id), projectB: await make(b.id) };
}

async function cleanup(sql: postgres.Sql, f: Fixture | null) {
  if (!f) return;
  const projects = [f.projectA, f.projectB];
  const users = [f.userA, f.userB];
  await sql`delete from stake_transactions where actor_user_id = any(${users}::uuid[])`;
  await sql`delete from payment_transactions where user_id = any(${users}::uuid[])`;
  await sql`delete from projects where id = any(${projects}::bigint[])`;
  await sql`delete from users where id = any(${users}::uuid[])`;
}

async function newAttack(
  sql: postgres.Sql,
  userId: string,
  projectId: number,
  targetProjectId: number,
): Promise<string> {
  const [row] = await sql`
    insert into payment_transactions
      (user_id, project_id, target_project_id, intent, provider, original_currency,
       original_amount, fx_rate_used, points_granted, status)
    values (${userId}, ${projectId}, ${targetProjectId}, 'attack', 'mock', 'UZS',
            ${ATTACK}, 1, ${ATTACK}, 'pending')
    returning id`;
  return row.id as string;
}

const isDeadlock = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '40P01';

Deno.test('встречные атаки A→B и B→A не дают дедлока', async () => {
  const sql = postgres(url!, { max: 6, prepare: false });
  let fixture: Fixture | null = null;
  const deadlocks: string[] = [];

  try {
    fixture = await seed(sql);
    const f = fixture;

    for (let i = 0; i < PAIRS; i += 1) {
      const [ab, ba] = await Promise.all([
        newAttack(sql, f.userA, f.projectA, f.projectB),
        newAttack(sql, f.userB, f.projectB, f.projectA),
      ]);

      // Обе стороны стартуют одновременно и трогают ровно одни и те же две
      // строки projects. Исход самой атаки не важен — лимиты быстро упрутся в
      // потолок, и она начнёт отказывать; блокировку функция берёт до
      // проверок, поэтому отказ проверяет порядок ровно так же, как успех.
      const outcome = await Promise.allSettled([
        sql`select * from apply_payment(${ab}::uuid, ${'dl-ab-' + i}, true)`,
        sql`select * from apply_payment(${ba}::uuid, ${'dl-ba-' + i}, true)`,
      ]);

      for (const one of outcome) {
        if (one.status === 'rejected' && isDeadlock(one.reason)) {
          deadlocks.push(String((one.reason as Error).message));
        }
      }
    }

    assertEquals(
      deadlocks,
      [],
      'apply_payment обязана брать строки projects по возрастанию id в обе стороны',
    );
  } finally {
    await cleanup(sql, fixture);
    await sql.end();
  }
});

Deno.test('контроль: обратный порядок тех же строк дедлок даёт', async () => {
  const sql = postgres(url!, { max: 4, prepare: false });
  let fixture: Fixture | null = null;
  let seen = false;

  try {
    fixture = await seed(sql);
    const f = fixture;
    const low = Math.min(f.projectA, f.projectB);
    const high = Math.max(f.projectA, f.projectB);

    for (let i = 0; i < PAIRS && !seen; i += 1) {
      const ascending = sql.begin(async (tx) => {
        await tx`select id from projects where id = ${low} for update`;
        await tx`select id from projects where id = ${high} for update`;
      });
      const descending = sql.begin(async (tx) => {
        await tx`select id from projects where id = ${high} for update`;
        await tx`select id from projects where id = ${low} for update`;
      });

      const outcome = await Promise.allSettled([ascending, descending]);
      seen = outcome.some((one) => one.status === 'rejected' && isDeadlock(one.reason));
    }

    assertEquals(
      seen,
      true,
      'стенд не воспроизводит дедлок даже на заведомо обратном порядке — ' +
        'значит и первый тест ничего не проверяет',
    );
  } finally {
    await cleanup(sql, fixture);
    await sql.end();
  }
});
