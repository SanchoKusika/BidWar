import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. README, раздел «Команды»');

/**
 * `apply_channel_admin` — единственное место, где права бота на канал
 * превращаются в задание на подписку. Каждый тест целиком внутри транзакции,
 * которая всегда откатывается: база общая с разработкой, и оставлять в ней
 * мусор нельзя.
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

async function addChannelProject(tx: postgres.TransactionSql, url: string): Promise<number> {
  const [user] = await tx`insert into users (display_name) values ('owner') returning id`;
  const [category] = await tx`select id from categories order by sort_order limit 1`;
  const [row] = await tx`
    insert into projects (user_id, category_id, name, url, type, status, paid_amount)
    values (${user.id}, ${category.id}, 'C', ${url}, 'paid', 'active', 100000)
    returning id`;
  return Number(row.id);
}

const subscribeTasks = async (tx: postgres.TransactionSql, projectId: number) => {
  const rows = await tx`
    select id, is_active from tasks where type = 'subscribe' and target_project_id = ${projectId}`;
  return rows;
};

Deno.test('юзернейм канала совпадает точно, а не по шаблону', async () => {
  await inRollback(async (tx) => {
    // При старом `like '%t.me/' || username` это совпадало: `_` в LIKE значит
    // «любой один символ», а в юзернеймах Telegram он сплошь и рядом.
    const project = await addChannelProject(tx, 'https://t.me/myxchannel');

    const [result] = await tx`select apply_channel_admin(null, 'my_channel', true) as id`;
    assertEquals(result.id, null, 'подчёркивание больше не совпадает с любым символом');
    assertEquals((await subscribeTasks(tx, project)).length, 0);
  });
});

Deno.test('точное совпадение заводит задание на подписку', async () => {
  await inRollback(async (tx) => {
    const project = await addChannelProject(tx, 'https://t.me/my_channel');

    const [result] = await tx`select apply_channel_admin(null, 'my_channel', true) as id`;
    assertEquals(Number(result.id), project);

    const tasks = await subscribeTasks(tx, project);
    assertEquals(tasks.length, 1);
    assertEquals(tasks[0].is_active, true);

    const [row] = await tx`select tg_bot_is_admin from projects where id = ${project}`;
    assertEquals(row.tg_bot_is_admin, true);
  });
});

Deno.test('хвост в ссылке не мешает совпадению', async () => {
  await inRollback(async (tx) => {
    const project = await addChannelProject(tx, 'https://t.me/my_channel/42');
    const [result] = await tx`select apply_channel_admin(null, 'my_channel', true) as id`;
    assertEquals(Number(result.id), project);
  });
});

Deno.test('повторный вызов не заводит второе задание', async () => {
  await inRollback(async (tx) => {
    const project = await addChannelProject(tx, 'https://t.me/my_channel');

    await tx`select apply_channel_admin(-1001, 'my_channel', true)`;
    await tx`select apply_channel_admin(-1001, 'my_channel', true)`;

    assertEquals((await subscribeTasks(tx, project)).length, 1, 'одно задание на проект');
  });
});

// Сюда ведут два входа — проверка владельца и апдейт `my_chat_member`, — и
// срабатывают они через секунды друг от друга. Безвредным второй делает
// уникальный индекс, поэтому его стоит доказать, а не поверить проверке.
Deno.test('второе задание на тот же проект не вставляется даже в обход функции', async () => {
  await inRollback(async (tx) => {
    const project = await addChannelProject(tx, 'https://t.me/my_channel');
    await tx`select apply_channel_admin(null, 'my_channel', true)`;

    let failed = false;
    try {
      await tx`
        insert into tasks (type, title, reward_votes, target_project_id)
        values ('subscribe', 'dupe', 2, ${project})`;
    } catch {
      failed = true;
    }
    assertEquals(failed, true, 'уникальный индекс, а не аккуратность вызывающего');
  });
});

Deno.test('снятие прав гасит задание, но не удаляет его', async () => {
  await inRollback(async (tx) => {
    const project = await addChannelProject(tx, 'https://t.me/my_channel');
    await tx`select apply_channel_admin(-1001, 'my_channel', true)`;

    await tx`select apply_channel_admin(-1001, 'my_channel', false)`;
    let tasks = await subscribeTasks(tx, project);
    assertEquals(tasks.length, 1);
    assertEquals(tasks[0].is_active, false);

    const [row] = await tx`select tg_bot_is_admin from projects where id = ${project}`;
    assertEquals(row.tg_bot_is_admin, false);

    // Права вернулись: задание оживает, а не заводится вторым.
    await tx`select apply_channel_admin(-1001, 'my_channel', true)`;
    tasks = await subscribeTasks(tx, project);
    assertEquals(tasks.length, 1);
    assertEquals(tasks[0].is_active, true);
  });
});

Deno.test('бесплатный проект каналом не считается', async () => {
  await inRollback(async (tx) => {
    const [user] = await tx`insert into users (display_name) values ('owner') returning id`;
    const [category] = await tx`select id from categories order by sort_order limit 1`;
    await tx`
      insert into projects (user_id, category_id, name, url, type, status, votes)
      values (${user.id}, ${category.id}, 'C', 'https://t.me/my_channel', 'free', 'active', 0)`;

    const [result] = await tx`select apply_channel_admin(null, 'my_channel', true) as id`;
    assertEquals(result.id, null, 'задания на подписку живут только у платных записей');
  });
});
