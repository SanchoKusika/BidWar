import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. план, задача 2');

/**
 * Attack в `apply_payment` (срез 1.6). Каждый тест целиком внутри транзакции,
 * которая всегда откатывается: база общая с разработкой.
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

async function addUser(tx: postgres.TransactionSql, name: string): Promise<string> {
  const [row] = await tx`insert into users (display_name) values (${name}) returning id`;
  return row.id as string;
}

async function addPaid(
  tx: postgres.TransactionSql,
  userId: string,
  amount: number,
  initialStake: number,
): Promise<Player> {
  const [category] = await tx`select id from categories order by sort_order limit 1`;
  const [row] = await tx`
    insert into projects (user_id, category_id, name, url, type, status, paid_amount, initial_stake)
    values (${userId}, ${category.id}, 'P', ${'https://a.example/' + crypto.randomUUID()},
            'paid', 'active', ${amount}, ${initialStake})
    returning id`;
  return { userId, projectId: Number(row.id) };
}

/** Одна атака: платёж + применение. Возвращает строку результата хранимки. */
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
  return { paymentId: payment.id as string, result };
}

const amountOf = async (tx: postgres.TransactionSql, id: number) => {
  const [row] = await tx`select paid_amount from projects where id = ${id}`;
  return Number(row.paid_amount);
};

// Разложенный по шагам пример из 01 Механики. Если этот тест разошёлся с
// документом — разошлась механика, а не тест.
Deno.test('пример из 01 Механики: два удара подряд с хейркатом', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 4_800_000, 4_800_000);
    const alpha = await addPaid(tx, await addUser(tx, 'alpha'), 5_000_000, 4_000_000);

    const first = await attack(tx, beta, alpha.projectId, 100_000, 'atk-1');
    assertEquals(first.result.applied, true);
    assertEquals(Number(first.result.credited_points), 100_000, 'первая атака по цели — 100%');
    assertEquals(await amountOf(tx, alpha.projectId), 4_900_000);
    assertEquals(await amountOf(tx, beta.projectId), 4_900_000);

    const second = await attack(tx, beta, alpha.projectId, 100_000, 'atk-2');
    assertEquals(Number(second.result.credited_points), 85_000, 'вторая по той же цели — 85%');
    assertEquals(await amountOf(tx, alpha.projectId), 4_800_000);
    assertEquals(await amountOf(tx, beta.projectId), 4_985_000);
  });
});

Deno.test('леджер сходится с обоими счётчиками', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 4_800_000, 4_800_000);
    const alpha = await addPaid(tx, await addUser(tx, 'alpha'), 5_000_000, 4_000_000);
    await attack(tx, beta, alpha.projectId, 100_000, 'atk-1');

    const [rows] = await tx`
      select count(*)::int as n, count(distinct transaction_group_id)::int as groups
        from stake_transactions where actor_user_id = ${beta.userId}`;
    assertEquals(rows.n, 2, 'attack_out и attack_in — две записи');
    assertEquals(rows.groups, 1, 'связаны одним transaction_group_id');

    const [out] = await tx`
      select amount, coefficient from stake_transactions
       where type = 'attack_out' and project_id = ${alpha.projectId}`;
    assertEquals(Number(out.amount), -100_000, 'урон записан со знаком минус');

    const [into] = await tx`
      select amount, coefficient from stake_transactions
       where type = 'attack_in' and project_id = ${beta.projectId}`;
    assertEquals(Number(into.amount), 100_000);
    assertEquals(Number(into.coefficient), 1, 'применённый коэффициент сохранён');
  });
});

Deno.test('атака не опускает цель ниже пола — отказ целиком, без частичного эффекта', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 1_000_000, 1_000_000);
    // Пол Alpha = 50% от 4 000 000 = 2 000 000, запас до него — 3 000 000.
    const alpha = await addPaid(tx, await addUser(tx, 'alpha'), 5_000_000, 4_000_000);

    const { paymentId, result } = await attack(tx, beta, alpha.projectId, 3_000_001, 'atk-floor');

    assertEquals(result.applied, false);
    assertEquals(result.reason, 'does_not_fit');
    assertEquals(await amountOf(tx, alpha.projectId), 5_000_000, 'ставка цели не тронута');
    assertEquals(await amountOf(tx, beta.projectId), 1_000_000, 'своя ставка не выросла');

    const [payment] = await tx`select status from payment_transactions where id = ${paymentId}`;
    assertEquals(payment.status, 'failed');
  });
});

Deno.test('ровно до пола — проходит', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 1_000_000, 1_000_000);
    const alpha = await addPaid(tx, await addUser(tx, 'alpha'), 5_000_000, 4_000_000);

    const { result } = await attack(tx, beta, alpha.projectId, 3_000_000, 'atk-exact');

    assertEquals(result.applied, true);
    assertEquals(await amountOf(tx, alpha.projectId), 2_000_000, 'цель стоит ровно на полу');
  });
});

Deno.test('суточный лимит по одной цели упирается в потолок', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 1_000_000, 1_000_000);
    const alpha = await addPaid(tx, await addUser(tx, 'alpha'), 5_000_000, 4_000_000);

    for (let i = 1; i <= 3; i += 1) {
      const { result } = await attack(tx, beta, alpha.projectId, 10_000, `atk-lim-${i}`);
      assertEquals(result.applied, true, `атака ${i} из трёх разрешённых`);
    }
    const fourth = await attack(tx, beta, alpha.projectId, 10_000, 'atk-lim-4');
    assertEquals(fourth.result.applied, false);
    assertEquals(fourth.result.reason, 'target_limit');
  });
});

Deno.test('хейркат считается по паре: другая цель снова со 100%', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 1_000_000, 1_000_000);
    const alpha = await addPaid(tx, await addUser(tx, 'alpha'), 5_000_000, 4_000_000);
    const gamma = await addPaid(tx, await addUser(tx, 'gamma'), 5_000_000, 4_000_000);

    await attack(tx, beta, alpha.projectId, 100_000, 'atk-pair-1');
    const again = await attack(tx, beta, alpha.projectId, 100_000, 'atk-pair-2');
    assertEquals(Number(again.result.credited_points), 85_000, 'по той же цели — со скидкой');

    const other = await attack(tx, beta, gamma.projectId, 100_000, 'atk-pair-3');
    assertEquals(
      Number(other.result.credited_points),
      100_000,
      'наказывается долбёжка одной жертвы, а не активность вообще',
    );
  });
});

Deno.test('свой проект и бесплатный проект не атакуются', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 1_000_000, 1_000_000);
    const victim = await addUser(tx, 'victim');
    const alpha = await addPaid(tx, victim, 5_000_000, 4_000_000);

    // Платёж от имени владельца цели — попытка ударить по себе.
    const [self] = await tx`
      insert into payment_transactions
        (user_id, project_id, target_project_id, intent, provider, original_currency,
         original_amount, fx_rate_used, points_granted, status)
      values (${victim}, ${beta.projectId}, ${alpha.projectId}, 'attack', 'mock', 'UZS',
              10000, 1, 10000, 'pending')
      returning id`;
    const [selfResult] = await tx`select * from apply_payment(${self.id}, 'atk-self', true)`;
    assertEquals(selfResult.reason, 'self_attack');

    const [category] = await tx`select id from categories order by sort_order limit 1`;
    const [free] = await tx`
      insert into projects (user_id, category_id, name, url, type, status, votes)
      values (${victim}, ${category.id}, 'F', ${'https://f.example/' + crypto.randomUUID()},
              'free', 'active', 10)
      returning id`;
    const onFree = await attack(tx, beta, Number(free.id), 10_000, 'atk-free');
    assertEquals(onFree.result.reason, 'target_not_paid', 'Attack не трогает votes');
  });
});

Deno.test('сбитый лидер отдаёт rank1_since тому, кто теперь первый', async () => {
  await inRollback(async (tx) => {
    const leader = await addPaid(tx, await addUser(tx, 'leader'), 5_000_000, 4_000_000);
    await tx`update projects set rank1_since = now() where id = ${leader.projectId}`;
    const second = await addPaid(tx, await addUser(tx, 'second'), 4_900_000, 4_900_000);
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 1_000_000, 1_000_000);

    const { result } = await attack(tx, beta, leader.projectId, 2_000_000, 'atk-lead');
    assertEquals(result.applied, true);

    const held = async (id: number) => {
      const [row] = await tx`select rank1_since is not null as held from projects where id = ${id}`;
      return row.held as boolean;
    };
    assertEquals(await held(leader.projectId), false, 'сбитый лидер отметку теряет');
    assertEquals(await held(second.projectId), true, 'отметка уходит новому первому');
    assertEquals(await held(beta.projectId), false);
  });
});

Deno.test('повторное применение подтверждённой атаки — no-op', async () => {
  await inRollback(async (tx) => {
    const beta = await addPaid(tx, await addUser(tx, 'beta'), 1_000_000, 1_000_000);
    const alpha = await addPaid(tx, await addUser(tx, 'alpha'), 5_000_000, 4_000_000);

    const { paymentId } = await attack(tx, beta, alpha.projectId, 100_000, 'atk-dup');
    const [again] = await tx`select * from apply_payment(${paymentId}, 'atk-dup', true)`;

    assertEquals(again.applied, false);
    assertEquals(again.reason, 'already_settled');
    assertEquals(await amountOf(tx, alpha.projectId), 4_900_000, 'урон не удвоился');
    assertEquals(await amountOf(tx, beta.projectId), 1_100_000, 'зачисление не удвоилось');
  });
});
