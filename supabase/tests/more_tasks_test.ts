import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. README, раздел «Команды»');

/**
 * The daily bonus, daily goals, ladders and one-time tasks
 * (`20261020120000_more_tasks.sql`): `task_progress`, `claim_task` and what
 * they hand to `apply_task_completion`. Every test runs inside a transaction
 * that is always rolled back: the database is shared with development.
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

type Tx = postgres.TransactionSql;

async function addUser(tx: Tx, name: string, referrerId?: string, balance = 0): Promise<string> {
  const [row] = await tx`
    insert into users (display_name, referrer_id, vote_balance)
    values (${name}, ${referrerId ?? null}, ${balance})
    returning id`;
  return row.id as string;
}

async function addProject(tx: Tx, userId: string, type: 'paid' | 'free'): Promise<number> {
  const [category] = await tx`select id from categories order by sort_order limit 1`;
  const [row] = await tx`
    insert into projects (user_id, category_id, name, url, type, paid_amount)
    values (${userId}, ${category.id}, 'T', ${'https://t.example/' + crypto.randomUUID()},
            ${type}, ${type === 'paid' ? 1000 : 0})
    returning id`;
  return Number(row.id);
}

const taskId = async (tx: Tx, type: string) => {
  const [row] = await tx`select id from tasks where type = ${type} and is_active limit 1`;
  return Number(row.id);
};

const balanceOf = async (tx: Tx, userId: string) => {
  const [row] = await tx`select vote_balance from users where id = ${userId}`;
  return Number(row.vote_balance);
};

const progressOf = async (tx: Tx, userId: string, type: string, facts: object = {}) => {
  const id = await taskId(tx, type);
  const [row] = await tx`
    select * from task_progress(${userId}, ${tx.json(facts as postgres.JSONValue)})
     where task_id = ${id}`;
  return row;
};

const claim = async (tx: Tx, userId: string, type: string, facts: object = {}) => {
  const id = await taskId(tx, type);
  const [row] = await tx`
    select * from claim_task(${userId}, ${id}, ${tx.json(facts as postgres.JSONValue)})`;
  return { claimed: row.claimed as boolean, granted: Number(row.granted) };
};

/** A daily-bonus row on an earlier day: current_date cannot move inside a transaction. */
const checkinOn = async (tx: Tx, userId: string, daysAgo: number, step: number) => {
  const id = await taskId(tx, 'daily_checkin');
  await tx`
    insert into task_completions (task_id, user_id, period_day, step, reward_votes, status, completed_at)
    values (${id}, ${userId}, current_date - ${daysAgo}::int, ${step}, 1, 'completed', now())`;
};

// ---------------------------------------------------------------------------
// Ladder arithmetic
// ---------------------------------------------------------------------------

Deno.test('ladder: the next goal follows the list, then steps on', async () => {
  await inRollback(async (tx) => {
    const params = tx.json({ goals: [3, 7, 14, 30], rewards: [2, 5, 10, 20], step: 30 });
    const [row] = await tx`
      select ladder_next_goal(${params}, 0) as a,
             ladder_next_goal(${params}, 7) as b,
             ladder_next_goal(${params}, 30) as c,
             ladder_next_goal(${params}, 60) as d,
             ladder_reward(${params}, 7) as r7,
             ladder_reward(${params}, 90) as r90`;
    assertEquals([row.a, row.b, row.c, row.d], [3, 14, 60, 90]);
    assertEquals([Number(row.r7), Number(row.r90)], [5, 20], 'past the list the last reward');
  });
});

// ---------------------------------------------------------------------------
// Daily bonus
// ---------------------------------------------------------------------------

Deno.test('daily bonus: once a day, ready again only tomorrow', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'checkin');

    const first = await claim(tx, user, 'daily_checkin');
    assertEquals(first, { claimed: true, granted: 1 });

    const second = await claim(tx, user, 'daily_checkin');
    assertEquals(second.claimed, false, 'the same day does not pay twice');
    assertEquals((await progressOf(tx, user, 'daily_checkin')).state, 'done');
    assertEquals(await balanceOf(tx, user), 1);
  });
});

Deno.test('daily bonus: yesterday continues the streak, a gap restarts it', async () => {
  await inRollback(async (tx) => {
    const kept = await addUser(tx, 'kept');
    await checkinOn(tx, kept, 1, 3);
    const day4 = await progressOf(tx, kept, 'daily_checkin');
    assertEquals([day4.claim_step, day4.current_value, Number(day4.reward)], [4, 3, 4]);

    const lapsed = await addUser(tx, 'lapsed');
    await checkinOn(tx, lapsed, 2, 5);
    const restart = await progressOf(tx, lapsed, 'daily_checkin');
    assertEquals(restart.claim_step, 1, 'a missed day starts over');
  });
});

Deno.test('daily bonus: every day pays one more, then holds at the ceiling', async () => {
  await inRollback(async (tx) => {
    const week = await addUser(tx, 'week');
    await checkinOn(tx, week, 1, 7);
    const day8 = await progressOf(tx, week, 'daily_checkin');
    assertEquals([day8.claim_step, day8.current_value, Number(day8.reward)], [8, 7, 8]);

    const long = await addUser(tx, 'long');
    await checkinOn(tx, long, 1, 12);
    const day13 = await progressOf(tx, long, 'daily_checkin');
    assertEquals([day13.claim_step, day13.current_value, Number(day13.reward)], [13, 10, 10]);
  });
});

// ---------------------------------------------------------------------------
// Daily votes and the votes ladder
// ---------------------------------------------------------------------------

Deno.test('daily votes: ready at the goal, paid once', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const project = await addProject(tx, owner, 'free');
    const voter = await addUser(tx, 'voter', undefined, 20);

    await tx`select * from cast_votes(${voter}, ${project}, 4)`;
    assertEquals((await progressOf(tx, voter, 'daily_votes')).state, 'available');
    assertEquals(
      (await claim(tx, voter, 'daily_votes')).claimed,
      false,
      'four of five is not five',
    );

    await tx`select * from cast_votes(${voter}, ${project}, 1)`;
    assertEquals((await progressOf(tx, voter, 'daily_votes')).state, 'ready');
    const paid = await claim(tx, voter, 'daily_votes');
    assertEquals(paid.claimed, true);
    assertEquals((await claim(tx, voter, 'daily_votes')).claimed, false);
  });
});

Deno.test('votes ladder: each goal pays once and the next one appears', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const project = await addProject(tx, owner, 'free');
    const voter = await addUser(tx, 'voter', undefined, 60);

    await tx`select * from cast_votes(${voter}, ${project}, 55)`;
    const first = await claim(tx, voter, 'ladder_votes');
    assertEquals(first, { claimed: true, granted: 2 });

    // 55 given is past 50 as well: the ladder catches up one step per claim.
    const step50 = await progressOf(tx, voter, 'ladder_votes');
    assertEquals([step50.state, step50.goal, Number(step50.reward)], ['ready', 50, 5]);
    assertEquals((await claim(tx, voter, 'ladder_votes')).granted, 5);

    const next = await progressOf(tx, voter, 'ladder_votes');
    assertEquals([next.state, next.goal, next.current_value], ['available', 100, 55]);
  });
});

// ---------------------------------------------------------------------------
// Referral: the inviter waits for an action, and a friend's streak pays
// ---------------------------------------------------------------------------

Deno.test('referral: the daily bonus is not the first action', async () => {
  await inRollback(async (tx) => {
    const inviter = await addUser(tx, 'inviter');
    const friend = await addUser(tx, 'friend', inviter);
    const owner = await addUser(tx, 'owner');
    const paid = await addProject(tx, owner, 'paid');

    await claim(tx, friend, 'daily_checkin');
    assertEquals(await balanceOf(tx, inviter), 0, 'opening the app pays the inviter nothing');

    await tx`select * from apply_task_completion(${friend}, 'visit', ${paid})`;
    const [ref] =
      await tx`select reward_votes from tasks where type = 'referral' and is_active limit 1`;
    assertEquals(await balanceOf(tx, inviter), Number(ref.reward_votes), 'a visit does');
  });
});

Deno.test('friend streak: a week of opening the app alone pays the inviter nothing', async () => {
  await inRollback(async (tx) => {
    const inviter = await addUser(tx, 'inviter');
    const friend = await addUser(tx, 'friend', inviter);
    await checkinOn(tx, friend, 1, 6);

    await claim(tx, friend, 'daily_checkin');
    assertEquals(await balanceOf(tx, inviter), 0);
  });
});

Deno.test(
  'friend streak: day seven after a real action pays once, without a referral message',
  async () => {
    await inRollback(async (tx) => {
      const inviter = await addUser(tx, 'inviter');
      const friend = await addUser(tx, 'friend', inviter);
      const owner = await addUser(tx, 'owner');
      const paid = await addProject(tx, owner, 'paid');

      await tx`select * from apply_task_completion(${friend}, 'visit', ${paid})`;
      const afterVisit = await balanceOf(tx, inviter);
      const messagesBefore = await tx`
        select id, payload from notifications where user_id = ${inviter} and kind = 'referral'`;

      await checkinOn(tx, friend, 1, 6);
      await claim(tx, friend, 'daily_checkin');
      const [bonus] =
        await tx`select reward_votes from tasks where type = 'referral_streak' limit 1`;
      assertEquals((await balanceOf(tx, inviter)) - afterVisit, Number(bonus.reward_votes));
      assertEquals((await progressOf(tx, inviter, 'referral_streak')).current_value, 1);

      const messagesAfter = await tx`
        select id, payload from notifications where user_id = ${inviter} and kind = 'referral'`;
      assertEquals(
        JSON.stringify(messagesAfter),
        JSON.stringify(messagesBefore),
        'the streak bonus is not «finished their first task»',
      );
    });
  },
);

// ---------------------------------------------------------------------------
// One-time tasks and the facts the Edge Function passes in
// ---------------------------------------------------------------------------

Deno.test('premium and boost are hidden without Premium', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'plain');
    assertEquals(await progressOf(tx, user, 'premium'), undefined);
    assertEquals(await progressOf(tx, user, 'boost'), undefined);

    assertEquals((await progressOf(tx, user, 'premium', { premium: true })).state, 'ready');
    assertEquals((await progressOf(tx, user, 'boost', { premium: true })).state, 'available');
    assertEquals((await claim(tx, user, 'premium', { premium: true })).claimed, true);
    assertEquals((await claim(tx, user, 'premium', { premium: true })).claimed, false);
  });
});

Deno.test('a fact the function did not pass leaves the task unpaid', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'nofacts');
    for (const type of ['site_login', 'bot_dm', 'add_project']) {
      assertEquals((await claim(tx, user, type)).claimed, false, type);
    }
    assertEquals(await balanceOf(tx, user), 0);

    assertEquals((await claim(tx, user, 'site_login', { site: true })).claimed, true);
    assertEquals((await claim(tx, user, 'bot_dm', { bot_reachable: true })).claimed, true);
  });
});

Deno.test('add project: ready once the free project exists', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'maker');
    assertEquals((await progressOf(tx, user, 'add_project')).state, 'available');
    await addProject(tx, user, 'free');
    assertEquals(await claim(tx, user, 'add_project'), { claimed: true, granted: 10 });
    assertEquals((await progressOf(tx, user, 'add_project')).state, 'done');
  });
});

// ---------------------------------------------------------------------------
// Scout: counted by the click itself
// ---------------------------------------------------------------------------

Deno.test('scout: a click on a new paid project counts, an old one does not', async () => {
  await inRollback(async (tx) => {
    const owner = await addUser(tx, 'owner');
    const otherOwner = await addUser(tx, 'other-owner');
    const visitor = await addUser(tx, 'visitor');
    const fresh = await addProject(tx, owner, 'paid');
    const old = await addProject(tx, otherOwner, 'paid');
    await tx`update projects set created_at = now() - interval '3 days' where id = ${old}`;

    const before = await progressOf(tx, visitor, 'daily_scout');
    assertEquals(before.target_project_id !== null, true, 'the card points at a new project');

    await tx`select register_project_click(${old}, ${visitor})`;
    const afterOld = await progressOf(tx, visitor, 'daily_scout');
    assertEquals(afterOld.current_value, before.current_value, 'an old project is not new');

    await tx`select register_project_click(${fresh}, ${visitor})`;
    const afterFresh = await progressOf(tx, visitor, 'daily_scout');
    assertEquals(afterFresh.current_value, before.current_value + 1);
  });
});

Deno.test('a task that is not ready pays nothing and keeps the balance', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'early', undefined, 7);
    const result = await claim(tx, user, 'ladder_visits');
    assertEquals(result, { claimed: false, granted: 0 });
    assertEquals(await balanceOf(tx, user), 7);
  });
});

Deno.test('task_progress narrowed to one task returns that task alone', async () => {
  await inRollback(async (tx) => {
    const user = await addUser(tx, 'narrow');
    const id = await taskId(tx, 'daily_checkin');
    const rows = await tx`select task_id from task_progress(${user}, '{}'::jsonb, ${id})`;
    assertEquals(
      rows.map((row) => Number(row.task_id)),
      [id],
    );
  });
});
