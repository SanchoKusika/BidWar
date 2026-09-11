import { assertEquals, assertAlmostEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. README, раздел «Команды»');

/**
 * Очередь уведомлений (срез 1.9): триггеры на леджере и `enqueue_notification`.
 * Каждый тест целиком внутри транзакции, которая всегда откатывается: база
 * общая с разработкой, и оставлять в ней мусор нельзя.
 *
 * Ставки считаются от `base` — текущего максимума живого борда. Абсолютные
 * числа здесь были бы тестом на содержимое базы, а не на хранимку: ровно на
 * этом уже один раз позеленел неверный тест (см. 12 Состояние реализации).
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

interface Player {
  userId: string;
  projectId: number;
}

async function addUser(
  tx: postgres.TransactionSql,
  name: string,
  referrerId?: string,
): Promise<string> {
  const [row] = await tx`
    insert into users (display_name, referrer_id) values (${name}, ${referrerId ?? null})
    returning id`;
  return row.id as string;
}

/** Максимум платного топа: от него считаются ставки, чтобы ранги были известны. */
async function paidBase(tx: postgres.TransactionSql): Promise<number> {
  const [row] = await tx`
    select coalesce(max(paid_amount), 0) as top from projects
     where type = 'paid' and status = 'active'`;
  return Number(row.top);
}

async function addProject(
  tx: postgres.TransactionSql,
  userId: string,
  type: 'paid' | 'free',
  metric: number,
): Promise<Player> {
  const [category] = await tx`select id from categories order by sort_order limit 1`;
  const [row] = await tx`
    insert into projects (user_id, category_id, name, url, type, status,
                          paid_amount, votes, initial_stake)
    values (${userId}, ${category.id}, 'N', ${'https://n.example/' + crypto.randomUUID()},
            ${type}, 'active',
            ${type === 'paid' ? metric : 0}, ${type === 'free' ? metric : 0},
            ${type === 'paid' ? metric : null})
    returning id`;
  return { userId, projectId: Number(row.id) };
}

async function attack(
  tx: postgres.TransactionSql,
  attacker: Player,
  targetProjectId: number,
  points: number,
  eventId: string,
) {
  const [payment] = await tx`
    insert into payment_transactions
      (user_id, project_id, target_project_id, intent, provider, original_currency,
       original_amount, fx_rate_used, points_granted, status)
    values (${attacker.userId}, ${attacker.projectId}, ${targetProjectId}, 'attack', 'mock',
            'UZS', ${points}, 1, ${points}, 'pending')
    returning id`;
  const [result] = await tx`select * from apply_payment(${payment.id}, ${eventId}, true)`;
  return result;
}

/** Очередь конкретного человека. Отправщика ещё нет, поэтому всё здесь — `sent_at is null`. */
async function queueOf(tx: postgres.TransactionSql, userId: string, kind?: string) {
  return await tx`
    select kind, group_key, payload, send_after from notifications
     where user_id = ${userId} and (${kind ?? null}::text is null or kind = ${kind ?? null})
     order by id`;
}

// ---------------------------------------------------------------------------
// Атака
// ---------------------------------------------------------------------------

Deno.test('атака кладёт жертве уведомление с рангом до и после', async () => {
  await inRollback(async (tx) => {
    const base = await paidBase(tx);
    const victim = await addProject(tx, await addUser(tx, 'victim'), 'paid', base + 3_000_000);
    const attacker = await addProject(tx, await addUser(tx, 'attacker'), 'paid', base + 1_000_000);

    const result = await attack(
      tx,
      attacker,
      victim.projectId,
      1_200_000,
      `ntf-${crypto.randomUUID()}`,
    );
    assertEquals(result.applied, true);

    const rows = await queueOf(tx, victim.userId, 'attacked');
    assertEquals(rows.length, 1, 'ровно одно уведомление');

    const payload = rows[0].payload as Record<string, unknown>;
    assertEquals(Number(payload.amount), 1_200_000, 'сумма удара, а не зачисления атакующему');
    assertEquals(Number(payload.rank_before), 1, 'до удара жертва была первой');
    assertEquals(Number(payload.rank_after), 2, 'после — атакующий выше');
    assertEquals(payload.attacker, 'attacker', 'имя атакующего раскрывается только здесь');
    assertEquals(Number(payload.count), 1);
    assertEquals(rows[0].group_key, String(victim.projectId));
  });
});

Deno.test('атакующему уведомления не кладётся — только жертве', async () => {
  await inRollback(async (tx) => {
    const base = await paidBase(tx);
    const victim = await addProject(tx, await addUser(tx, 'victim'), 'paid', base + 3_000_000);
    const attacker = await addProject(tx, await addUser(tx, 'attacker'), 'paid', base + 1_000_000);

    await attack(tx, attacker, victim.projectId, 1_200_000, `ntf-${crypto.randomUUID()}`);

    assertEquals((await queueOf(tx, attacker.userId)).length, 0);
  });
});

Deno.test('две атаки подряд — одно уведомление: суммы сложились, «ранг до» от первой', async () => {
  await inRollback(async (tx) => {
    const base = await paidBase(tx);
    const victim = await addProject(tx, await addUser(tx, 'victim'), 'paid', base + 3_000_000);
    const attacker = await addProject(tx, await addUser(tx, 'attacker'), 'paid', base + 1_000_000);

    await attack(tx, attacker, victim.projectId, 1_200_000, `ntf-${crypto.randomUUID()}`);
    await attack(tx, attacker, victim.projectId, 300_000, `ntf-${crypto.randomUUID()}`);

    const rows = await queueOf(tx, victim.userId, 'attacked');
    assertEquals(rows.length, 1, 'серия атак не превращается в серию сообщений');

    const payload = rows[0].payload as Record<string, unknown>;
    assertEquals(Number(payload.count), 2);
    assertEquals(Number(payload.amount), 1_500_000, 'суммы ударов сложились');
    assertEquals(Number(payload.rank_before), 1, 'первое число окна — от первого события');
    assertEquals(Number(payload.rank_after), 2, 'последнее — от последнего');
  });
});

Deno.test('выключенная настройка не кладёт строку вовсе', async () => {
  await inRollback(async (tx) => {
    const base = await paidBase(tx);
    const victimUser = await addUser(tx, 'victim');
    await tx`update users set notify_attacked = false where id = ${victimUser}`;
    const victim = await addProject(tx, victimUser, 'paid', base + 3_000_000);
    const attacker = await addProject(tx, await addUser(tx, 'attacker'), 'paid', base + 1_000_000);
    await tx`update projects set rank1_since = now() - interval '1 hour'
              where id = ${victim.projectId}`;

    await attack(tx, attacker, victim.projectId, 1_200_000, `ntf-${crypto.randomUUID()}`);

    assertEquals((await queueOf(tx, victim.userId, 'attacked')).length, 0);
    assertEquals(
      (await queueOf(tx, victim.userId, 'rank_lost')).length,
      1,
      'выключен один вид, а не все',
    );
  });
});

// ---------------------------------------------------------------------------
// Первое место
// ---------------------------------------------------------------------------

Deno.test('потеря первого места несёт срок удержания', async () => {
  await inRollback(async (tx) => {
    const base = await paidBase(tx);
    const victim = await addProject(tx, await addUser(tx, 'victim'), 'paid', base + 3_000_000);
    const attacker = await addProject(tx, await addUser(tx, 'attacker'), 'paid', base + 1_000_000);
    await tx`update projects set rank1_since = now() - interval '2 hours'
              where id = ${victim.projectId}`;

    await attack(tx, attacker, victim.projectId, 1_200_000, `ntf-${crypto.randomUUID()}`);

    const rows = await queueOf(tx, victim.userId, 'rank_lost');
    assertEquals(rows.length, 1);

    const payload = rows[0].payload as Record<string, unknown>;
    assertEquals(payload.top, 'paid');
    assertAlmostEquals(Number(payload.held_seconds), 7200, 60, 'держал два часа');
  });
});

Deno.test('голоса отбирают первое место в бесплатном топе — и это тоже уведомление', async () => {
  await inRollback(async (tx) => {
    const [top] = await tx`
      select coalesce(max(votes), 0) as votes from projects where type = 'free' and status = 'active'`;
    const base = Number(top.votes);

    const leader = await addProject(tx, await addUser(tx, 'leader'), 'free', base + 10);
    await tx`update projects set rank1_since = now() - interval '30 minutes'
              where id = ${leader.projectId}`;
    const rival = await addProject(tx, await addUser(tx, 'rival'), 'free', base + 5);

    const voter = await addUser(tx, 'voter');
    await tx`update users set vote_balance = 100 where id = ${voter}`;
    const [cast] = await tx`select * from cast_votes(${voter}, ${rival.projectId}, 20)`;
    assertEquals(cast.applied, true);

    const rows = await queueOf(tx, leader.userId, 'rank_lost');
    assertEquals(rows.length, 1, 'отметку снимает cast_votes — триггер один на оба топа');
    assertEquals((rows[0].payload as Record<string, unknown>).top, 'free');
  });
});

// ---------------------------------------------------------------------------
// Голоса и приглашённые
// ---------------------------------------------------------------------------

Deno.test('голос за чужой проект уведомляет владельца, за свой — нет', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const project = await addProject(tx, owner, 'free', 0);

    const voter = await addUser(tx, 'voter');
    await tx`update users set vote_balance = 100 where id = ${voter}`;
    await tx`update users set vote_balance = 100 where id = ${owner}`;

    await tx`select * from cast_votes(${voter}, ${project.projectId}, 7)`;
    await tx`select * from cast_votes(${owner}, ${project.projectId}, 3)`;

    const rows = await queueOf(tx, owner, 'votes');
    assertEquals(rows.length, 1, 'своё же нажатие кнопки не уведомляется');
    assertEquals(Number((rows[0].payload as Record<string, unknown>).amount), 7);
  });
});

Deno.test('несколько голосов за сутки складываются в один дайджест', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const project = await addProject(tx, owner, 'free', 0);

    for (const name of ['a', 'b', 'c']) {
      const voter = await addUser(tx, name);
      await tx`update users set vote_balance = 100 where id = ${voter}`;
      await tx`select * from cast_votes(${voter}, ${project.projectId}, 4)`;
    }

    const rows = await queueOf(tx, owner, 'votes');
    assertEquals(rows.length, 1);
    assertEquals(Number((rows[0].payload as Record<string, unknown>).count), 3);
    assertEquals(Number((rows[0].payload as Record<string, unknown>).amount), 12);
  });
});

Deno.test('приглашённый дошёл до первого задания — уведомление пригласившему', async () => {
  await inRollback(async (tx) => {
    const referrer = await addUser(tx, 'referrer');
    const friend = await addUser(tx, 'friend', referrer);
    const project = await addProject(tx, await addUser(tx, 'owner'), 'paid', 100_000);

    const [done] =
      await tx`select * from apply_task_completion(${friend}, 'visit', ${project.projectId})`;
    const referralReward = Number(done.referral_granted);

    const rows = await queueOf(tx, referrer, 'referral');
    assertEquals(rows.length, 1);
    assertEquals(Number((rows[0].payload as Record<string, unknown>).amount), referralReward);

    assertEquals((await queueOf(tx, friend)).length, 0, 'самому новичку сообщать нечего');
  });
});
