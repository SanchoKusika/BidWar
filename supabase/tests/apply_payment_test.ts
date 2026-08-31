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

// Находка 3, второй раунд ревью: предыдущий тест («лидер сменяется несколько
// раз подряд») — регрессионный, но не доказательство: он проходит и на
// допатченной функции, потому что внутри одной последовательной транзакции
// v_leader_before физически не может устареть между своим чтением и локом —
// устареть он может только из-за ДРУГОЙ, параллельной транзакции, которая
// успевает сменить лидера, пока эта ждёт лок. Тест ниже воспроизводит именно
// это двумя настоящими соединениями (порт пулера Supabase — 5432, session
// mode: соединение закреплено за клиентом на весь сеанс, поэтому открытая
// транзакция на втором соединении держится между await'ами так же, как на
// прямом подключении):
//
//  1. Второе соединение берёт FOR UPDATE на строке L — глобально самой
//     дорогой активной платной строке, она же станет v_leader_before для
//     будущего вызова apply_payment — и не коммитит.
//  2. Первое соединение вызывает apply_payment по платежу, который обязан
//     сделать проект C новым лидером. Он блокируется на локе L (это первая
//     `perform ... for update` функции — она блокировала бы так же и до
//     находки 3, и после). Promise.race с коротким таймаутом подтверждает
//     именно блокировку, а не ошибку и не проезд мимо.
//  3. Пока первое соединение ждёт, второе — ВНУТРИ ТОЙ ЖЕ, ещё не
//     закоммиченной транзакции — переносит метку лидера с L на третий
//     проект D и коммитит по-настоящему. Коммит одновременно отпускает лок
//     на L и делает D новым держателем rank1_since — ровно та гонка из
//     находки 3: «текущий держатель rank1_since сменился, пока эта
//     транзакция ждала лок на v_leader_before».
//  4. Первое соединение разблокируется и обязано: не упасть, не
//     дедлокнуться, снять rank1_since именно с D — строки, которой не было
//     в исходном наборе локов {C, L} — и поставить его на C.
//
// Проект использует настоящие commit'ы (не откат): второму соединению иначе
// не увидеть L/D/C/платёж, вставленные первым. Поэтому у теста — в отличие
// от всех остальных в этом файле — есть собственная ручная очистка в finally
// и предохранитель по времени на удержание лока, чтобы упавший тест не
// оставил висящую транзакцию на общей базе.
//
// ГРАНИЦА ЭТОГО ТЕСТА (третий раунд ревью). Формулировка ниже в прошлой
// версии комментария утверждала, что шаг 4 — «содержательная проверка
// второго perform ... for update». Это оказалось неверно, и вот как
// проверено: тело функции ДО находки 3 (миграция 20260830120000) было
// заведено под отдельным именем apply_payment_legacy_probe отдельными
// execute_sql (create/drop, без апдейта живой apply_payment) и прогнано
// через ровно тот же сценарий двух соединений — оно тоже проходит: не
// падает, не дедлокается, корректно снимает rank1_since с D и ставит его на
// C. Причина проста: к моменту, когда первое соединение (в любой версии
// функции) доходит до пересчёта rank1_since, держатель D уже свободен —
// второе соединение закоммитилось и отпустило все локи ДО того, как первое
// соединение вообще начинает трогать D. Единственная строка, которую нужно
// заблокировать в этот момент, — D, и она одна что через явный
// `perform ... for update`, что через локирование внутри обычного UPDATE
// получает лок мгновенно, без конкуренции. Тест поэтому доказывает
// корректность ИТОГОВОГО СОСТОЯНИЯ под реальным конкурентным commit'ом (это
// по-прежнему ценно: до этого раунда такого сценария с настоящими двумя
// соединениями в наборе не было, только последовательная симуляция) — но не
// доказывает, что лок на D в принципе необходим или что именно он
// предотвращает дедлок.
//
// Настоящую разницу между старой и новой функцией дал бы сценарий, где ТРЕТЬЯ
// сторона удерживает D (или другую строку из объединения находки 3) в момент,
// когда первое соединение пытается её тронуть — тогда в старой функции это
// был бы конфликт локов в порядке, не совпадающем с остальной функцией
// (потенциальный дедлок), а в новой — упорядоченное ожидание. Такой тест
// сюда сознательно не добавлен: свойство, которое чинит находка 3, —
// «единый порядок блокировки по возрастанию id одинаков ВО ВСЕХ местах,
// которые могут блокировать пересекающиеся строки», а единственный другой
// потенциальный конкурент с пересекающимися локами по проекту — Attack
// (срез 1.6) — в коде ещё не существует. Подставить вместо него свою,
// самодельную третью транзакцию с произвольным порядком локов означало бы
// проверять СВОё же предположение о порядке, а не инвариант из кода; а
// различие в поведении старой функции пришлось бы вытягивать из того, в
// каком порядке implicit UPDATE фактически блокирует совпадающие строки —
// это решает планировщик Postgres (seq scan vs index scan, физический
// порядок кортежей), не документировано и не гарантировано между версиями —
// такой тест проверял бы детектор дедлоков и планировщик Postgres, а не наш
// код. Гарантия отсутствия дедлока остаётся аргументом на уровне чтения кода
// (единый порядок `order by id` во всех `for update` функции) и должна быть
// перепроверена самим тестом в срезе 1.6, когда появится Attack и станет
// возможно свести настоящую третью сторону.
Deno.test(
  'второе соединение держит лок на текущем лидере — apply_payment блокируется, потом корректно снимает rank1_since с чужой строки',
  async () => {
    const mainClient = postgres(url!, { max: 1, prepare: false });
    const holderClient = postgres(url!, { max: 1, prepare: false });

    let releaseHolder: () => void = () => {};
    let markHolderReady: () => void = () => {};
    const holderReady = new Promise<void>((resolve) => {
      markHolderReady = resolve;
    });
    const releaseSignal = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });
    // Предохранитель: если тест упадёт раньше, чем сам отпустит держателя,
    // лок на L снимется максимум через 10с, а не повиснет на общей базе.
    const holderSafety = setTimeout(() => releaseHolder(), 10_000);

    const cleanup: { users: string[]; projects: number[]; paymentId: string | null } = {
      users: [],
      projects: [],
      paymentId: null,
    };
    let holderPromise: Promise<void> | undefined;

    try {
      // Свои данные, не сидовые: L и D должны быть одновременно активными
      // платными проектами разных пользователей (projects_one_active_per_user_and_type_idx
      // не даёт одному юзеру две активных платных строки), C — третий.
      const [top] =
        await mainClient`select coalesce(max(paid_amount), 0) as v from projects where type = 'paid'`;
      const base = Number(top.v) + 1_000_000;
      const [category] = await mainClient`select id from categories order by sort_order limit 1`;

      const [userL] =
        await mainClient`insert into users (display_name) values ('test-lockrace-l') returning id`;
      const [userD] =
        await mainClient`insert into users (display_name) values ('test-lockrace-d') returning id`;
      const [userC] =
        await mainClient`insert into users (display_name) values ('test-lockrace-c') returning id`;
      cleanup.users.push(userL.id, userD.id, userC.id);

      const [leader] = await mainClient`
        insert into projects (user_id, category_id, name, url, type, status, paid_amount,
                              initial_stake, rank1_since)
        values (${userL.id}, ${category.id}, 'L', ${'https://lockrace-l.example/' + crypto.randomUUID()},
                'paid', 'active', ${base + 1}, ${base + 1}, now())
        returning id`;
      const [newLeader] = await mainClient`
        insert into projects (user_id, category_id, name, url, type, status, paid_amount, initial_stake)
        values (${userD.id}, ${category.id}, 'D', ${'https://lockrace-d.example/' + crypto.randomUUID()},
                'paid', 'active', ${base + 2}, ${base + 2})
        returning id`;
      const [challenger] = await mainClient`
        insert into projects (user_id, category_id, name, url, type, status)
        values (${userC.id}, ${category.id}, 'C', ${'https://lockrace-c.example/' + crypto.randomUUID()},
                'paid', 'pending_payment')
        returning id`;
      cleanup.projects.push(leader.id, newLeader.id, challenger.id);

      const challengerPoints = base + 1000;
      const [payment] = await mainClient`
        insert into payment_transactions
          (user_id, project_id, intent, provider, original_currency, original_amount,
           fx_rate_used, points_granted, status)
        values (${userC.id}, ${challenger.id}, 'raise', 'mock', 'UZS', ${challengerPoints}, 1,
                ${challengerPoints}, 'pending')
        returning id`;
      cleanup.paymentId = payment.id;

      // Второе соединение: держит FOR UPDATE на L, потом (после сигнала)
      // переносит rank1_since на D и коммитит по-настоящему — этот коммит и
      // есть внешняя гонка, которую чинит находка 3.
      //
      // Предохранитель СЕРВЕРНОЙ стороны (пере-ревью раунда 3): клиентский
      // таймаут в finally ниже защищает только от упавшего, но ещё живого
      // процесса — он не сработает при жёстком обрыве (SIGKILL, разрыв сети),
      // потому что тогда finally просто не выполнится. На инстансе
      // idle_in_transaction_session_timeout и lock_timeout выключены
      // (0), а tcp_keepalives_idle — 1800с, поэтому без своего предохранителя
      // осиротевшая транзакция держала бы лок на L до получаса. L здесь —
      // заведомо самая дорогая активная платная строка, то есть глобальный
      // лидер топа: следующий пересчёт rank1_since в ЛЮБОМ вызове
      // apply_payment (не только в тестах — в реальных платежах тоже) берёт
      // лок ровно на лидера и встанет на этом же локе на весь statement_timeout
      // (120с) на каждой попытке, пока L не освободится. set local действует
      // только внутри этой транзакции и откатывается вместе с ней — глобальных
      // настроек инстанса не меняет и прав суперпользователя не требует.
      // Значение (15с) — заведомо больше времени, которое тест реально держит
      // лок в нормальном прогоне (Promise.race с таймаутом 2с плюс сама работа
      // держателя, итого разы меньше 15с), и заведомо меньше statement_timeout.
      holderPromise = holderClient.begin(async (holderTx) => {
        await holderTx`set local idle_in_transaction_session_timeout = '15s'`;
        await holderTx`select id from projects where id = ${leader.id} for update`;
        markHolderReady();
        await releaseSignal;
        await holderTx`update projects set rank1_since = null where id = ${leader.id}`;
        await holderTx`update projects set rank1_since = now() where id = ${newLeader.id}`;
      });

      await holderReady;

      // Первое соединение: настоящий вызов apply_payment. v_leader_before
      // внутри него — это L (глобально самая дорогая активная платная
      // строка), поэтому самая первая блокировка функции ждёт лок, который
      // держит holder.
      await mainClient
        .begin(async (tx) => {
          const applyPromise = tx`select * from apply_payment(${payment.id}, 'evt-lockrace', true)`;

          const TIMEOUT = Symbol('timeout');
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), 2000));
          const raced = await Promise.race([applyPromise, timeoutPromise]);
          assertEquals(
            raced,
            TIMEOUT,
            'apply_payment обязан блокироваться на локе L, а не падать и не проезжать мимо',
          );

          releaseHolder();
          const applyRows = await applyPromise;
          await holderPromise;

          const [result] = applyRows;
          assertEquals(
            result.applied,
            true,
            'после освобождения лока вызов обязан доехать до конца без дедлока',
          );
          assertEquals(Number(result.points_granted), challengerPoints);

          const [challengerAfter] = await tx`
            select paid_amount, status, rank1_since from projects where id = ${challenger.id}`;
          assertEquals(Number(challengerAfter.paid_amount), challengerPoints);
          assertEquals(challengerAfter.status, 'active');
          assertEquals(challengerAfter.rank1_since !== null, true, 'челленджер стал новым лидером');

          const [newLeaderAfter] =
            await tx`select rank1_since from projects where id = ${newLeader.id}`;
          assertEquals(
            newLeaderAfter.rank1_since,
            null,
            'у D — держателя rank1_since, которого не было в исходном наборе локов {C, L}, — отметка снята',
          );

          const [oldLeaderAfter] =
            await tx`select rank1_since from projects where id = ${leader.id}`;
          assertEquals(oldLeaderAfter.rank1_since, null, 'у L отметка тоже не восстановилась');

          throw new Error('__rollback_lockrace_main__');
        })
        .catch((error) => {
          if (!(error instanceof Error) || error.message !== '__rollback_lockrace_main__')
            throw error;
        });
    } finally {
      clearTimeout(holderSafety);
      releaseHolder();
      if (holderPromise) await holderPromise.catch(() => {});
      await mainClient.end();
      await holderClient.end();

      // L/D/C и платёж создавались настоящими commit'ами (иначе второму
      // соединению их не увидеть) — откат tx выше стирает только эффекты
      // apply_payment (paid_amount, stake_transactions, статус платежа), но
      // не сами строки. Убираем их руками, отдельным соединением, независимо
      // от того, чем закончился тест.
      const cleanupClient = postgres(url!, { max: 1, prepare: false });
      try {
        if (cleanup.paymentId) {
          await cleanupClient`delete from stake_transactions where payment_id = ${cleanup.paymentId}`;
          await cleanupClient`delete from payment_transactions where id = ${cleanup.paymentId}`;
        }
        if (cleanup.projects.length > 0) {
          await cleanupClient`delete from projects where id in ${cleanupClient(cleanup.projects)}`;
        }
        if (cleanup.users.length > 0) {
          await cleanupClient`delete from users where id in ${cleanupClient(cleanup.users)}`;
        }
      } finally {
        await cleanupClient.end();
      }
    }
  },
);
