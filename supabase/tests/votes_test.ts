import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. README, раздел «Команды»');

/**
 * Задания и голоса (срез 1.7): `apply_task_completion` и `cast_votes`. Каждый
 * тест целиком внутри транзакции, которая всегда откатывается: база общая с
 * разработкой, и оставлять в ней мусор нельзя.
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

async function addProject(
  tx: postgres.TransactionSql,
  userId: string,
  type: 'paid' | 'free',
  metric: number,
  status: 'active' | 'hidden' = 'active',
): Promise<number> {
  const [category] = await tx`select id from categories order by sort_order limit 1`;
  const [row] = await tx`
    insert into projects (user_id, category_id, name, url, type, status, paid_amount, votes)
    values (${userId}, ${category.id}, 'T', ${'https://t.example/' + crypto.randomUUID()},
            ${type}, ${status}, ${type === 'paid' ? metric : 0}, ${type === 'free' ? metric : 0})
    returning id`;
  return Number(row.id);
}

const balanceOf = async (tx: postgres.TransactionSql, userId: string) => {
  const [row] = await tx`select vote_balance from users where id = ${userId}`;
  return Number(row.vote_balance);
};

const votesOf = async (tx: postgres.TransactionSql, projectId: number) => {
  const [row] = await tx`select votes from projects where id = ${projectId}`;
  return Number(row.votes);
};

/** Награда за тип задания — из строки задания, а не из константы в тесте. */
const rewardFor = async (tx: postgres.TransactionSql, type: string) => {
  const [row] = await tx`
    select reward_votes from tasks where type = ${type} and target_project_id is null limit 1`;
  return Number(row.reward_votes);
};

// ---------------------------------------------------------------------------
// visit: возобновляемый раз в сутки на проект
// ---------------------------------------------------------------------------

Deno.test('visit начисляет голос и не начисляет второй раз за те же сутки', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const visitor = await addUser(tx, 'visitor');
    const project = await addProject(tx, owner, 'paid', 100000);
    const reward = await rewardFor(tx, 'visit');

    const [first] = await tx`select * from apply_task_completion(${visitor}, 'visit', ${project})`;
    assertEquals(Number(first.granted), reward);
    assertEquals(await balanceOf(tx, visitor), reward);

    const [second] = await tx`select * from apply_task_completion(${visitor}, 'visit', ${project})`;
    assertEquals(Number(second.granted), 0, 'второй заход в те же сутки не платит');
    assertEquals(await balanceOf(tx, visitor), reward, 'баланс не вырос');
  });
});

Deno.test('visit по другому проекту начисляется в те же сутки', async () => {
  await inRollback(async (tx) => {
    // Владельцы разные: на пользователя приходится одна активная запись в
    // каждом топе (projects_one_active_per_user_and_type_idx).
    const first = await addUser(tx, 'owner-a');
    const secondOwner = await addUser(tx, 'owner-b');
    const visitor = await addUser(tx, 'visitor');
    const a = await addProject(tx, first, 'paid', 100000);
    const b = await addProject(tx, secondOwner, 'paid', 200000);
    const reward = await rewardFor(tx, 'visit');

    await tx`select * from apply_task_completion(${visitor}, 'visit', ${a})`;
    const [second] = await tx`select * from apply_task_completion(${visitor}, 'visit', ${b})`;

    assertEquals(Number(second.granted), reward, 'ключ различает проекты');
    assertEquals(await balanceOf(tx, visitor), reward * 2);
  });
});

Deno.test('вчерашний visit не мешает сегодняшнему', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const visitor = await addUser(tx, 'visitor');
    const project = await addProject(tx, owner, 'paid', 100000);
    const reward = await rewardFor(tx, 'visit');

    // Вчерашняя строка кладётся руками: сдвинуть current_date внутри одной
    // транзакции нечем, а именно суточное окно тут и проверяется.
    const [task] = await tx`select id, reward_votes from tasks where type = 'visit' limit 1`;
    await tx`
      insert into task_completions
        (task_id, user_id, project_id, period_day, reward_votes, status, completed_at)
      values (${task.id}, ${visitor}, ${project}, current_date - 1, ${task.reward_votes},
              'completed', now() - interval '1 day')`;

    const [today] = await tx`select * from apply_task_completion(${visitor}, 'visit', ${project})`;
    assertEquals(Number(today.granted), reward, 'новые сутки — новое засчитывание');
  });
});

Deno.test('клик по карточке засчитывает visit тем же заходом', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const visitor = await addUser(tx, 'visitor');
    const project = await addProject(tx, owner, 'paid', 100000);
    const reward = await rewardFor(tx, 'visit');

    const [first] = await tx`select register_project_click(${project}, ${visitor}) as counted`;
    assertEquals(first.counted, true);
    assertEquals(await balanceOf(tx, visitor), reward, 'клик и задание — одно окно');

    const [again] = await tx`select register_project_click(${project}, ${visitor}) as counted`;
    assertEquals(again.counted, false, 'клик в те же сутки не считается');
    assertEquals(await balanceOf(tx, visitor), reward, 'и не платит второй раз');
  });
});

// ---------------------------------------------------------------------------
// referral: за каждого друга, после его первого задания
// ---------------------------------------------------------------------------

Deno.test('реферер получает награду за первое задание приглашённого', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const referrer = await addUser(tx, 'referrer');
    const invited = await addUser(tx, 'invited', referrer);
    const project = await addProject(tx, owner, 'paid', 100000);
    const referralReward = await rewardFor(tx, 'referral');

    assertEquals(await balanceOf(tx, referrer), 0, 'до действия приглашённого — ноль');

    const [result] = await tx`select * from apply_task_completion(${invited}, 'visit', ${project})`;
    assertEquals(Number(result.referral_granted), referralReward);
    assertEquals(await balanceOf(tx, referrer), referralReward);
  });
});

Deno.test('второе задание того же приглашённого рефереру больше не платит', async () => {
  await inRollback(async (tx) => {
    const ownerA = await addUser(tx, 'owner-a');
    const ownerB = await addUser(tx, 'owner-b');
    const referrer = await addUser(tx, 'referrer');
    const invited = await addUser(tx, 'invited', referrer);
    const a = await addProject(tx, ownerA, 'paid', 100000);
    const b = await addProject(tx, ownerB, 'paid', 200000);
    const referralReward = await rewardFor(tx, 'referral');

    await tx`select * from apply_task_completion(${invited}, 'visit', ${a})`;
    const [second] = await tx`select * from apply_task_completion(${invited}, 'visit', ${b})`;

    assertEquals(Number(second.referral_granted), 0, 'награда за друга, а не за задание');
    assertEquals(await balanceOf(tx, referrer), referralReward);
  });
});

Deno.test('второй приглашённый приносит вторую награду', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const referrer = await addUser(tx, 'referrer');
    const first = await addUser(tx, 'first', referrer);
    const second = await addUser(tx, 'second', referrer);
    const project = await addProject(tx, owner, 'paid', 100000);
    const referralReward = await rewardFor(tx, 'referral');

    await tx`select * from apply_task_completion(${first}, 'visit', ${project})`;
    await tx`select * from apply_task_completion(${second}, 'visit', ${project})`;

    assertEquals(
      await balanceOf(tx, referrer),
      referralReward * 2,
      'ключ по паре «пригласивший + приглашённый», а не по заданию',
    );
  });
});

Deno.test('без реферера награду не получает никто', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const alone = await addUser(tx, 'alone');
    const project = await addProject(tx, owner, 'paid', 100000);

    const [result] = await tx`select * from apply_task_completion(${alone}, 'visit', ${project})`;
    assertEquals(Number(result.referral_granted), 0);
  });
});

// ---------------------------------------------------------------------------
// cast_votes: отдача голосов
// ---------------------------------------------------------------------------

Deno.test('голос уходит с баланса, приходит проекту и пишется в леджер', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const voter = await addUser(tx, 'voter');
    const project = await addProject(tx, owner, 'free', 5);
    await tx`update users set vote_balance = 10 where id = ${voter}`;

    const [result] = await tx`select * from cast_votes(${voter}, ${project}, 4)`;

    assertEquals(result.applied, true);
    assertEquals(Number(result.balance_after), 6);
    assertEquals(await balanceOf(tx, voter), 6);
    assertEquals(await votesOf(tx, project), 9);

    const [ledger] = await tx`
      select coalesce(sum(amount), 0) as total from vote_transactions
       where project_id = ${project} and user_id = ${voter}`;
    assertEquals(Number(ledger.total), 4, 'голоса проекта = сумма его vote-транзакций');
  });
});

Deno.test('голос можно отдать чужому проекту', async () => {
  await inRollback(async (tx) => {
    const stranger = await addUser(tx, 'stranger');
    const voter = await addUser(tx, 'voter');
    const project = await addProject(tx, stranger, 'free', 0);
    await tx`update users set vote_balance = 3 where id = ${voter}`;

    const [result] = await tx`select * from cast_votes(${voter}, ${project}, 3)`;
    assertEquals(result.applied, true, 'проверки «это твоя запись» нет и быть не должно');
    assertEquals(await votesOf(tx, project), 3);
  });
});

Deno.test('больше баланса отдать нельзя', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const voter = await addUser(tx, 'voter');
    const project = await addProject(tx, owner, 'free', 0);
    await tx`update users set vote_balance = 2 where id = ${voter}`;

    const [result] = await tx`select * from cast_votes(${voter}, ${project}, 3)`;

    assertEquals(result.applied, false);
    assertEquals(result.reason, 'insufficient_balance');
    assertEquals(await balanceOf(tx, voter), 2, 'баланс не тронут');
    assertEquals(await votesOf(tx, project), 0);
  });
});

Deno.test('ноль и отрицательное количество отвергаются', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const voter = await addUser(tx, 'voter');
    const project = await addProject(tx, owner, 'free', 0);
    await tx`update users set vote_balance = 5 where id = ${voter}`;

    for (const amount of [0, -3]) {
      const [result] = await tx`select * from cast_votes(${voter}, ${project}, ${amount})`;
      assertEquals(result.applied, false);
      assertEquals(result.reason, 'bad_amount');
    }
    assertEquals(await balanceOf(tx, voter), 5);
  });
});

Deno.test('платный проект и скрытый бесплатный целью быть не могут', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const voter = await addUser(tx, 'voter');
    const paid = await addProject(tx, owner, 'paid', 100000);
    const hidden = await addProject(tx, owner, 'free', 0, 'hidden');
    await tx`update users set vote_balance = 5 where id = ${voter}`;

    for (const target of [paid, hidden]) {
      const [result] = await tx`select * from cast_votes(${voter}, ${target}, 1)`;
      assertEquals(result.applied, false);
      assertEquals(result.reason, 'bad_target');
    }
    assertEquals(await balanceOf(tx, voter), 5);
  });
});

Deno.test('rank1_since переезжает к новому лидеру бесплатного топа', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const voter = await addUser(tx, 'voter');

    // Выше всех живых строк бесплатного топа, иначе лидером останется он.
    const [top] = await tx`
      select coalesce(max(votes), 0) as v from projects where type = 'free' and status = 'active'`;
    const base = Number(top.v);

    const rivalOwner = await addUser(tx, 'rival-owner');
    const leader = await addProject(tx, owner, 'free', base + 100);
    const rival = await addProject(tx, rivalOwner, 'free', base + 50);
    await tx`update projects set rank1_since = now() where id = ${leader}`;
    await tx`update users set vote_balance = 100 where id = ${voter}`;

    const [result] = await tx`select * from cast_votes(${voter}, ${rival}, 100)`;
    assertEquals(result.applied, true);

    const [rivalRow] = await tx`select rank1_since from projects where id = ${rival}`;
    const [leaderRow] = await tx`select rank1_since from projects where id = ${leader}`;
    assertEquals(rivalRow.rank1_since !== null, true, 'обогнавший получает отметку');
    assertEquals(leaderRow.rank1_since, null, 'прежний лидер её теряет');
  });
});

Deno.test('голос в бесплатном топе не сбивает отметку лидера платного', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const voter = await addUser(tx, 'voter');
    const [paidLeader] = await tx`
      select id from projects where type = 'paid' and status = 'active'
       order by paid_amount desc, id asc limit 1`;
    await tx`update projects set rank1_since = now() where id = ${paidLeader.id}`;

    const free = await addProject(tx, owner, 'free', 0);
    await tx`update users set vote_balance = 1 where id = ${voter}`;
    await tx`select * from cast_votes(${voter}, ${free}, 1)`;

    const [after] = await tx`select rank1_since from projects where id = ${paidLeader.id}`;
    assertEquals(after.rank1_since !== null, true, 'два топа держат отметку независимо');
  });
});

// ---------------------------------------------------------------------------
// balance_after: экран не должен складывать баланс сам
// ---------------------------------------------------------------------------

Deno.test('засчитанное задание возвращает получившийся баланс', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const visitor = await addUser(tx, 'visitor');
    const project = await addProject(tx, owner, 'paid', 100000);
    const reward = await rewardFor(tx, 'visit');
    await tx`update users set vote_balance = 7 where id = ${visitor}`;

    const [result] = await tx`select * from apply_task_completion(${visitor}, 'visit', ${project})`;

    assertEquals(Number(result.balance_after), 7 + reward);
    assertEquals(await balanceOf(tx, visitor), 7 + reward, 'то же число, что и в базе');
  });
});

// Повтор ничего не платит, но обязан сказать правду: вызывающий мог держать у
// себя устаревшее число и ровно его и показал бы обратно.
Deno.test('повтор ничего не платит и возвращает текущий баланс', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const visitor = await addUser(tx, 'visitor');
    const project = await addProject(tx, owner, 'paid', 100000);
    const reward = await rewardFor(tx, 'visit');

    await tx`select * from apply_task_completion(${visitor}, 'visit', ${project})`;
    const [again] = await tx`select * from apply_task_completion(${visitor}, 'visit', ${project})`;

    assertEquals(Number(again.granted), 0);
    assertEquals(Number(again.balance_after), reward);
  });
});

// Доплата пригласившему падает на другую строку и другой экран. Вписать её в
// это число значило бы солгать ровно так же, как лгало сложение на клиенте.
Deno.test('баланс в ответе — свой, без доплаты пригласившему', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const referrer = await addUser(tx, 'referrer');
    const invited = await addUser(tx, 'invited', referrer);
    const project = await addProject(tx, owner, 'paid', 100000);
    const visitReward = await rewardFor(tx, 'visit');
    const referralReward = await rewardFor(tx, 'referral');

    const [result] = await tx`select * from apply_task_completion(${invited}, 'visit', ${project})`;

    assertEquals(Number(result.referral_granted), referralReward);
    assertEquals(Number(result.balance_after), visitReward, 'свой баланс, не сумма двоих');
    assertEquals(await balanceOf(tx, referrer), referralReward);
  });
});

// ---------------------------------------------------------------------------
// visit платит только за платные проекты
// ---------------------------------------------------------------------------

Deno.test('клик по бесплатному проекту не платит голос, по платному — платит', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const free = await addProject(tx, owner, 'free', 10);
    const paid = await addProject(tx, owner, 'paid', 100000);
    const visitor = await addUser(tx, 'visitor');
    const reward = await rewardFor(tx, 'visit');

    const [freeClick] = await tx`select register_project_click(${free}, ${visitor}) as counted`;
    assertEquals(freeClick.counted, true, 'переход всё равно считается');
    assertEquals(await balanceOf(tx, visitor), 0, 'но голос за него не платят');

    await tx`select register_project_click(${paid}, ${visitor})`;
    assertEquals(await balanceOf(tx, visitor), reward, 'платный проект платит');
  });
});

Deno.test('задание площадки (свой канал) засчитывается без проекта и только раз', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'subscriber');
    const reward = await rewardFor(tx, 'subscribe');

    // Строка задания площадки: проекта у неё нет, чат лежит в ней самой.
    const [task] = await tx`
      select id, target_chat_id from tasks
       where type = 'subscribe' and target_project_id is null and is_active
       limit 1`;
    // Строка обязана существовать: `task?.x !== null` пропустил бы undefined,
    // и тест падал бы дальше невнятным TypeError вместо этой проверки. Тип
    // сравнивать нельзя — bigint приезжает из драйвера строкой.
    assertEquals(
      Number.isFinite(Number(task?.target_chat_id)),
      true,
      'канал площадки задан в самой строке',
    );

    const [first] = await tx`select * from apply_task_completion(${user}, 'subscribe', null)`;
    assertEquals(Number(first.granted), reward, 'подписка платит из app_config');
    assertEquals(await balanceOf(tx, user), reward);

    const [again] = await tx`select * from apply_task_completion(${user}, 'subscribe', null)`;
    assertEquals(Number(again.granted), 0, 'второй раз не платит');
    assertEquals(await balanceOf(tx, user), reward);

    const [row] = await tx`
      select task_id, project_id from task_completions
       where user_id = ${user} and status = 'completed'`;
    assertEquals(Number(row.task_id), Number(task.id));
    assertEquals(row.project_id, null, 'у задания площадки проекта нет');
  });
});

Deno.test('проверка по id засчитывает именно своё задание, а не чужое', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'subscriber');
    const owner = await addUser(tx, 'owner');
    const projectId = await addProject(tx, owner, 'paid', 100_000);

    // Задание канала проекта — и оно гаснет между проверкой и начислением
    // (владелец снял права у бота). Раньше хранимка в этот момент молча
    // подставляла задание площадки, у которого проекта нет.
    const [projectTask] = await tx`
      insert into tasks (type, title, description, reward_votes, target_project_id)
      values ('subscribe', 'Subscribe to project', null, 2, ${projectId})
      returning id`;
    await tx`update tasks set is_active = false where id = ${projectTask.id}`;

    const [result] = await tx`
      select * from apply_task_completion(${user}, 'subscribe', ${projectId}, ${projectTask.id})`;

    assertEquals(Number(result.granted), 0, 'погасшее задание не платит');
    assertEquals(await balanceOf(tx, user), 0, 'и не платит чужим заданием тоже');

    const [{ count }] = await tx`
      select count(*)::int as count from task_completions where user_id = ${user}`;
    assertEquals(count, 0, 'задание площадки осталось нетронутым');
  });
});

Deno.test('visit платит не больше предела переходов в сутки', async () => {
  await inRollback(async (tx) => {
    const visitor = await addUser(tx, 'visitor');
    const reward = await rewardFor(tx, 'visit');

    const [limitRow] = await tx`
      select coalesce((value ->> 'visit_per_day')::int, 10) as limit
        from app_config where key = 'task_limits'`;
    const limit = Number(limitRow.limit);

    // Проектов на один больше предела: без него упереться было бы не во что.
    // Владелец каждому свой — на аккаунт приходится одна платная запись
    // (projects_one_active_per_user_and_type_idx).
    const projects: number[] = [];
    for (let i = 0; i <= limit; i += 1) {
      projects.push(await addProject(tx, await addUser(tx, `owner-${i}`), 'paid', 100_000));
    }

    for (const projectId of projects.slice(0, limit)) {
      await tx`select register_project_click(${projectId}, ${visitor})`;
    }
    assertEquals(await balanceOf(tx, visitor), reward * limit, 'предел оплачен целиком');

    const extra = projects[limit]!;
    const [click] = await tx`select register_project_click(${extra}, ${visitor}) as counted`;
    assertEquals(click.counted, true, 'переход всё равно считается');
    assertEquals(
      await balanceOf(tx, visitor),
      reward * limit,
      'одиннадцатый заход голос не платит',
    );
  });
});

// Предел, который не держит под нагрузкой, — подпись, а не предел. Клики идут
// каждый своим соединением: так они и приходят с телефона, и так вызовы не
// делят пул с уборкой в конце.
Deno.test('параллельные переходы не пробивают суточный предел', async () => {
  const admin = postgres(url!, { max: 1, prepare: false });
  const created: { users: string[]; projects: number[] } = { users: [], projects: [] };

  try {
    const [limitRow] = await admin`
      select coalesce((value ->> 'visit_per_day')::int, 10) as limit
        from app_config where key = 'task_limits'`;
    const limit = Number(limitRow.limit);
    const [rewardRow] = await admin`
      select reward_votes from tasks where type = 'visit' and target_project_id is null limit 1`;
    const reward = Number(rewardRow.reward_votes);

    const [category] = await admin`select id from categories order by sort_order limit 1`;
    const [visitor] = await admin`
      insert into users (display_name) values ('race-visitor') returning id`;
    created.users.push(visitor.id as string);

    // На два проекта больше предела: столько кликов уйдёт разом.
    for (let i = 0; i < limit + 2; i += 1) {
      const [owner] = await admin`
        insert into users (display_name) values (${'race-owner-' + i}) returning id`;
      created.users.push(owner.id as string);
      const [project] = await admin`
        insert into projects (user_id, category_id, name, url, type, status, paid_amount)
        values (${owner.id}, ${category.id}, 'R', ${'https://r.example/' + crypto.randomUUID()},
                'paid', 'active', 100000)
        returning id`;
      created.projects.push(Number(project.id));
    }

    const clients = created.projects.map(() => postgres(url!, { max: 1, prepare: false }));
    try {
      // allSettled: отказ одного вызова не должен ни прерывать остальные, ни
      // мешать проверке — предел обязан держаться в любом случае.
      await Promise.allSettled(
        created.projects.map(
          (projectId, i) => clients[i]!`select register_project_click(${projectId}, ${visitor.id})`,
        ),
      );
    } finally {
      await Promise.allSettled(clients.map((c) => c.end()));
    }

    const [balance] = await admin`select vote_balance from users where id = ${visitor.id}`;
    const [counted] = await admin`
      select count(*)::int as n from project_clicks
       where project_id = any(${created.projects}::bigint[])`;

    assertEquals(
      Number(balance.vote_balance),
      reward * Math.min(limit, Number(counted.n)),
      'оплачено ровно столько переходов, сколько дошло, но не больше предела',
    );
    assertEquals(
      Number(balance.vote_balance) <= reward * limit,
      true,
      'предел не пробивается параллельными вызовами',
    );
  } finally {
    // Тест коммитит по-настоящему — параллельные транзакции иначе не увидят
    // друг друга. Убираем за собой сами, как это делает тест на дедлок.
    await admin`delete from task_completions where user_id = any(${created.users}::uuid[])`;
    await admin`delete from project_clicks where project_id = any(${created.projects}::bigint[])`;
    await admin`delete from projects where id = any(${created.projects}::bigint[])`;
    await admin`delete from notifications where user_id = any(${created.users}::uuid[])`;
    await admin`delete from users where id = any(${created.users}::uuid[])`;
    await admin.end();
  }
});
