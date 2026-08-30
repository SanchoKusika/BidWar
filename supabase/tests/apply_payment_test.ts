import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. план, задача 2');

/**
 * Каждый тест целиком внутри транзакции, которая всегда откатывается: база
 * общая с разработкой, и оставлять в ней мусор нельзя.
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

/** Пользователь, категория и платный проект в статусе pending_payment. */
async function seed(tx: postgres.TransactionSql, points: number) {
  const [user] = await tx`
    insert into users (display_name) values ('test') returning id`;
  const [category] = await tx`select id from categories order by sort_order limit 1`;
  const [project] = await tx`
    insert into projects (user_id, category_id, name, url, type, status)
    values (${user.id}, ${category.id}, 'T', ${'https://t.example/' + crypto.randomUUID()},
            'paid', 'pending_payment')
    returning id`;
  const [payment] = await tx`
    insert into payment_transactions
      (user_id, project_id, intent, provider, original_currency, original_amount,
       fx_rate_used, points_granted, status)
    values (${user.id}, ${project.id}, 'raise', 'mock', 'UZS', ${points}, 1, ${points}, 'pending')
    returning id`;
  return { userId: user.id, projectId: project.id, paymentId: payment.id };
}

Deno.test('подтверждение поднимает ставку и открывает проект', async () => {
  await inRollback(async (tx) => {
    const { projectId, paymentId } = await seed(tx, 100000);
    const [result] = await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    assertEquals(result.applied, true);
    assertEquals(Number(result.points_granted), 100000);

    const [project] = await tx`select * from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 100000);
    assertEquals(Number(project.initial_stake), 100000);
    assertEquals(project.status, 'active');

    const [ledger] = await tx`
      select coalesce(sum(amount), 0) as total from stake_transactions where project_id = ${projectId}`;
    assertEquals(Number(ledger.total), 100000, 'очки проекта = сумма его stake-транзакций');
  });
});

Deno.test('повторный вызов ничего не меняет', async () => {
  await inRollback(async (tx) => {
    const { projectId, paymentId } = await seed(tx, 100000);
    await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;
    const [second] = await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    assertEquals(second.applied, false);
    const [project] = await tx`select paid_amount from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 100000, 'вторая попытка не удвоила ставку');
    const [rows] = await tx`
      select count(*)::int as n from stake_transactions where payment_id = ${paymentId}`;
    assertEquals(rows.n, 1);
  });
});

Deno.test('отказ провайдера не начисляет очков и не открывает проект', async () => {
  await inRollback(async (tx) => {
    const { projectId, paymentId } = await seed(tx, 100000);
    const [result] = await tx`select * from apply_payment(${paymentId}, 'evt-1', false)`;

    assertEquals(result.applied, false);
    const [project] = await tx`select paid_amount, status from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 0);
    assertEquals(project.status, 'pending_payment');
    const [payment] = await tx`select status from payment_transactions where id = ${paymentId}`;
    assertEquals(payment.status, 'failed');
  });
});

Deno.test('initial_stake фиксируется первым платежом и не меняется вторым', async () => {
  await inRollback(async (tx) => {
    const { userId, projectId, paymentId } = await seed(tx, 100000);
    await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    const [second] = await tx`
      insert into payment_transactions
        (user_id, project_id, intent, provider, original_currency, original_amount,
         fx_rate_used, points_granted, status)
      values (${userId}, ${projectId}, 'raise', 'mock', 'UZS', 50000, 1, 50000, 'pending')
      returning id`;
    await tx`select * from apply_payment(${second.id}, 'evt-2', true)`;

    const [project] =
      await tx`select paid_amount, initial_stake from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 150000);
    assertEquals(Number(project.initial_stake), 100000, 'база для floor — первая ставка');
  });
});

Deno.test('rank1_since переезжает к новому лидеру', async () => {
  await inRollback(async (tx) => {
    // Прежний лидер: ставка заведомо выше всего, что есть в базе.
    const [top] =
      await tx`select coalesce(max(paid_amount), 0) as v from projects where type = 'paid'`;
    const leaderBid = Number(top.v) + 1_000_000;

    const { userId: oldUser } = await seed(tx, 1);
    const [category] = await tx`select id from categories order by sort_order limit 1`;
    const [old] = await tx`
      insert into projects (user_id, category_id, name, url, type, status, paid_amount,
                            initial_stake, rank1_since)
      values (${oldUser}, ${category.id}, 'Old', ${'https://o.example/' + crypto.randomUUID()},
              'paid', 'active', ${leaderBid}, ${leaderBid}, now())
      returning id`;

    const { projectId, paymentId } = await seed(tx, leaderBid + 1);
    await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    const [winner] = await tx`select rank1_since from projects where id = ${projectId}`;
    const [loser] = await tx`select rank1_since from projects where id = ${old.id}`;
    assertEquals(winner.rank1_since !== null, true, 'новый лидер получил отметку');
    assertEquals(loser.rank1_since, null, 'у прежнего отметка снята');
  });
});

// Находка 2 ревью задачи 2: два РАЗНЫХ платежа, подтверждённых с одним и тем
// же provider_event_id. Финальный update payment_transactions в apply_payment
// (тот, что пишет provider_event_id вместе с status = 'confirmed') раньше не
// был защищён от unique_violation по (provider, provider_event_id) — второй
// платёж ронял вызывающую транзакцию сырым исключением Postgres и навсегда
// оставался в статусе pending вместо failed. Без правки миграции
// 20260830150000 этот тест падает с необработанным PostgresError, а не
// доходит до assertEquals.
Deno.test(
  'гонка за один provider_event_id: второй платёж не бросает исключение и остаётся failed',
  async () => {
    await inRollback(async (tx) => {
      const first = await seed(tx, 100000);
      const second = await seed(tx, 50000);

      const [firstResult] =
        await tx`select * from apply_payment(${first.paymentId}, 'evt-dup', true)`;
      assertEquals(firstResult.applied, true, 'первый платёж с этим event_id проходит как обычно');

      const [secondResult] =
        await tx`select * from apply_payment(${second.paymentId}, 'evt-dup', true)`;
      assertEquals(
        secondResult.applied,
        false,
        'второй платёж с занятым event_id обязан вернуть applied = false, а не бросить исключение',
      );

      const [secondProject] =
        await tx`select paid_amount, status from projects where id = ${second.projectId}`;
      assertEquals(Number(secondProject.paid_amount), 0, 'очки второго платежа не начислены');
      assertEquals(secondProject.status, 'pending_payment', 'проект второго платежа не открылся');

      const [secondPayment] =
        await tx`select status from payment_transactions where id = ${second.paymentId}`;
      assertEquals(secondPayment.status, 'failed', 'платёж помечен failed, а не завис в pending');

      const [ledger] = await tx`
      select count(*)::int as n from stake_transactions where payment_id = ${second.paymentId}`;
      assertEquals(ledger.n, 0, 'stake_transactions второго платежа откачены вместе с paid_amount');

      // Первый платёж и его начисление остаются нетронутыми — откат второго
      // платежа не должен задевать состояние первого.
      const [firstProject] =
        await tx`select paid_amount from projects where id = ${first.projectId}`;
      assertEquals(Number(firstProject.paid_amount), 100000);
    });
  },
);

// Находка 3 ревью задачи 2: пересчёт rank1_since раньше блокировал только
// v_payment.project_id и лидера ДО операции, но трогал (в UPDATE без
// предварительного FOR UPDATE) любую строку с непустым rank1_since — в
// конкурентной раскладке это давало либо гонку, либо дедлок вместо ожидания.
// Настоящую блокирующую гонку из двух-трёх параллельных транзакций нельзя
// воспроизвести в одной транзакции с одним соединением (это и естественный
// предел этого тестового харнесса, и то, что описано в задаче как
// «насколько воспроизводимо в одной транзакции») — v_leader_before внутри
// одного вызова apply_payment всегда актуален в момент чтения, потому что
// никто другой не меняет БД параллельно с сериализованным тестом. Поэтому
// ниже — регрессионная проверка корректности пересчёта на ЦЕПОЧКЕ из трёх
// последовательных смен лидера: она гоняет новый блок PERFORM ... FOR UPDATE
// несколько раз подряд с каждый раз другим v_leader_after и проверяет
// инвариант «ровно один держатель rank1_since» на каждом шаге. Правильность
// самой блокировки от гонки между транзакциями подтверждается прочтением
// кода (тот же порядок id, что и в самой первой блокировке функции), а не
// этим тестом.
Deno.test(
  'лидер сменяется несколько раз подряд — отметка каждый раз переезжает целиком',
  async () => {
    await inRollback(async (tx) => {
      const [top] =
        await tx`select coalesce(max(paid_amount), 0) as v from projects where type = 'paid'`;
      const base = Number(top.v) + 1_000_000;

      const first = await seed(tx, base + 1);
      await tx`select * from apply_payment(${first.paymentId}, 'evt-chain-1', true)`;
      const [afterFirst] = await tx`select rank1_since from projects where id = ${first.projectId}`;
      assertEquals(afterFirst.rank1_since !== null, true, 'первый платёж делает проект лидером');

      const second = await seed(tx, base + 2);
      await tx`select * from apply_payment(${second.paymentId}, 'evt-chain-2', true)`;

      const third = await seed(tx, base + 3);
      await tx`select * from apply_payment(${third.paymentId}, 'evt-chain-3', true)`;

      const [firstAfter] = await tx`select rank1_since from projects where id = ${first.projectId}`;
      const [secondAfter] =
        await tx`select rank1_since from projects where id = ${second.projectId}`;
      const [thirdAfter] = await tx`select rank1_since from projects where id = ${third.projectId}`;

      assertEquals(firstAfter.rank1_since, null, 'у первого лидера отметка снята при второй смене');
      assertEquals(
        secondAfter.rank1_since,
        null,
        'у второго лидера отметка снята при третьей смене',
      );
      assertEquals(
        thirdAfter.rank1_since !== null,
        true,
        'последний в цепочке держит отметку один',
      );
    });
  },
);
