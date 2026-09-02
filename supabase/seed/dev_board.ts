/**
 * Живые записи в топах стенда вместо `example.com/seed/...`.
 *
 * Первая миграция засеяла тридцать строк с выдуманными именами и ссылками на
 * несуществующие адреса. Для проверки механик этого мало: у такой строки нет
 * ни описания, ни превью, по ней нельзя перейти, и любой скриншот витрины
 * выглядит как заглушка. Скрипт заменяет их настоящими проектами — ссылка,
 * описание и картинка тянутся из живого OG **той же функцией `fetchOg`**, что
 * работает в `add-project`, поэтому запись неотличима от добавленной руками.
 *
 * Ставки, голоса, клики и владельцы остаются прежними: они и так правдоподобны,
 * а трогать их значило бы переписывать историю платежей (`initial_stake` —
 * база для пола атаки).
 *
 * Категория менять нельзя (`forbid_project_identity_change`), поэтому каждая
 * сидовая строка получает проект своей категории.
 *
 * Идемпотентен: повторный запуск находит записи по ссылке и просто обновляет
 * OG. Только для стенда — на боевой базе ему делать нечего.
 *
 *   SUPABASE_DB_URL=... npm run db:seed:dev
 */
import postgres from 'npm:postgres@3';
import { fetchOg } from '../functions/_shared/og.ts';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. README, раздел «База»');

interface SeedProject {
  /** Имя на карточке. Своё, а не og:title: у половины сайтов там строка на 60 символов с хвостом «— лучший в мире». */
  name: string;
  url: string;
  type: 'paid' | 'free';
  /** Слаг категории — id резолвится из базы, чтобы не зашивать числа. */
  category: string;
  /**
   * Ставка/голоса для строк, которым не нашлось сидовой пары (категория
   * Profiles заведена позже первой миграции и сидов не имеет).
   */
  metric: number;
}

// Порядок внутри пары «категория + тип» значим: строки раздаются сидовым
// записям по убыванию ставки, то есть первый в списке встаёт выше.
const PROJECTS: readonly SeedProject[] = [
  // Channels
  {
    name: 'Telegram News',
    url: 'https://t.me/telegram',
    type: 'paid',
    category: 'channels',
    metric: 457000,
  },
  {
    name: 'Telegram Info',
    url: 'https://t.me/tginfo',
    type: 'paid',
    category: 'channels',
    metric: 272000,
  },
  {
    name: 'Pavel Durov',
    url: 'https://t.me/durov',
    type: 'paid',
    category: 'channels',
    metric: 87000,
  },
  {
    name: 'Gram of TON',
    url: 'https://t.me/toncoin',
    type: 'free',
    category: 'channels',
    metric: 263,
  },
  {
    name: 'Telegram Contests',
    url: 'https://t.me/contest',
    type: 'free',
    category: 'channels',
    metric: 148,
  },
  {
    name: 'Beta Info',
    url: 'https://t.me/betainfo',
    type: 'free',
    category: 'channels',
    metric: 33,
  },

  // Bots
  {
    name: 'BotFather',
    url: 'https://t.me/BotFather',
    type: 'paid',
    category: 'bots',
    metric: 494000,
  },
  { name: 'Quiz Bot', url: 'https://t.me/QuizBot', type: 'paid', category: 'bots', metric: 309000 },
  {
    name: 'Gmail Bot',
    url: 'https://t.me/GmailBot',
    type: 'paid',
    category: 'bots',
    metric: 124000,
  },
  { name: 'GIF Search', url: 'https://t.me/gif', type: 'free', category: 'bots', metric: 286 },
  { name: 'VoteBot', url: 'https://t.me/vote', type: 'free', category: 'bots', metric: 171 },
  { name: 'LikeBot', url: 'https://t.me/like', type: 'free', category: 'bots', metric: 56 },

  // Sites
  { name: 'GitHub', url: 'https://github.com', type: 'paid', category: 'sites', metric: 531000 },
  { name: 'Figma', url: 'https://www.figma.com', type: 'paid', category: 'sites', metric: 346000 },
  { name: 'Notion', url: 'https://www.notion.so', type: 'paid', category: 'sites', metric: 161000 },
  { name: 'Obsidian', url: 'https://obsidian.md', type: 'free', category: 'sites', metric: 309 },
  { name: 'Raycast', url: 'https://www.raycast.com', type: 'free', category: 'sites', metric: 194 },
  { name: 'Linear', url: 'https://linear.app', type: 'free', category: 'sites', metric: 79 },

  // Business
  {
    name: 'Shopify',
    url: 'https://www.shopify.com',
    type: 'paid',
    category: 'business',
    metric: 568000,
  },
  { name: 'Stripe', url: 'https://stripe.com', type: 'paid', category: 'business', metric: 383000 },
  {
    name: 'Texnomart',
    url: 'https://texnomart.uz',
    type: 'paid',
    category: 'business',
    metric: 198000,
  },
  { name: 'Click', url: 'https://click.uz', type: 'free', category: 'business', metric: 332 },
  { name: 'Korzinka', url: 'https://korzinka.uz', type: 'free', category: 'business', metric: 217 },
  {
    name: 'Mailchimp',
    url: 'https://mailchimp.com',
    type: 'free',
    category: 'business',
    metric: 102,
  },

  // Services
  {
    name: 'Cloudflare',
    url: 'https://www.cloudflare.com',
    type: 'paid',
    category: 'services',
    metric: 605000,
  },
  {
    name: 'Supabase',
    url: 'https://supabase.com',
    type: 'paid',
    category: 'services',
    metric: 420000,
  },
  { name: 'Sentry', url: 'https://sentry.io', type: 'paid', category: 'services', metric: 235000 },
  { name: 'Glovo', url: 'https://glovoapp.com', type: 'free', category: 'services', metric: 355 },
  {
    name: 'Calendly',
    url: 'https://calendly.com',
    type: 'free',
    category: 'services',
    metric: 240,
  },
  { name: 'Slack', url: 'https://slack.com', type: 'free', category: 'services', metric: 125 },

  // Profiles — категория заведена вне первой миграции, сидовых строк под неё нет:
  // эти четыре записи создаются вместе со своими владельцами.
  {
    name: 'Linus Torvalds',
    url: 'https://github.com/torvalds',
    type: 'paid',
    category: 'profiles',
    metric: 300000,
  },
  {
    name: 'NASA',
    url: 'https://www.instagram.com/nasa',
    type: 'paid',
    category: 'profiles',
    metric: 150000,
  },
  {
    name: 'Dan Abramov',
    url: 'https://github.com/gaearon',
    type: 'free',
    category: 'profiles',
    metric: 210,
  },
  {
    name: 'Telegram Messenger',
    url: 'https://www.linkedin.com/company/telegram-messenger',
    type: 'free',
    category: 'profiles',
    metric: 95,
  },
];

/** Строки первой миграции узнаются по адресу — своего признака у них нет. */
const PLACEHOLDER_URL = 'https://example.com/seed/%';

const sql = postgres(url, { max: 4, prepare: false });

try {
  const categories = await sql<{ id: number; slug: string }[]>`select id, slug from categories`;
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));

  // OG всех тридцати четырёх адресов сразу: последовательно это несколько
  // минут, а запросы независимы.
  const og = await Promise.all(
    PROJECTS.map(async (p) => {
      const result = await fetchOg(p.url);
      console.log(`${result.status === 'ok' ? '✓' : '✗'} ${p.url}`);
      return result;
    }),
  );

  let updated = 0;
  let created = 0;
  let ownerSeq = 16;

  for (const [index, project] of PROJECTS.entries()) {
    const catId = categoryId.get(project.category);
    if (catId === undefined) throw new Error(`Нет категории ${project.category}`);

    const meta = og[index]!;
    const fields = {
      name: project.name,
      url: project.url,
      og_description: meta.description,
      og_image_url: meta.imageUrl,
      og_status: meta.status,
      og_fetched_at: new Date(),
    };

    const [existing] = await sql<{ id: number }[]>`
      select id from projects where url = ${project.url} and type = ${project.type}
    `;
    if (existing) {
      await sql`update projects set ${sql(fields)} where id = ${existing.id}`;
      updated += 1;
      continue;
    }

    // Свободная сидовая строка своей категории и типа — берём самую дорогую,
    // а список выше упорядочен так же, поэтому раздача устойчива к повторам.
    const metric = project.type === 'paid' ? sql`paid_amount` : sql`votes`;
    const [placeholder] = await sql<{ id: number }[]>`
      select id from projects
       where type = ${project.type}
         and category_id = ${catId}
         and url like ${PLACEHOLDER_URL}
       order by ${metric} desc
       limit 1
    `;
    if (placeholder) {
      await sql`update projects set ${sql(fields)} where id = ${placeholder.id}`;
      updated += 1;
      continue;
    }

    // Ни своей строки, ни свободной сидовой: заводим владельца и запись.
    // initial_stake равен ставке — так же, как его проставляет открывающий
    // платёж, иначе пол атаки посчитается не от той базы.
    await sql.begin(async (tx) => {
      const [owner] = await tx<{ id: string }[]>`
        insert into users (display_name) values (${`Seed Owner ${ownerSeq}`}) returning id
      `;
      ownerSeq += 1;
      await tx`
        insert into projects (user_id, category_id, name, url, type, paid_amount, votes, initial_stake,
                              og_description, og_image_url, og_status, og_fetched_at, status)
        values (${owner!.id}, ${catId}, ${project.name}, ${project.url}, ${project.type},
                ${project.type === 'paid' ? project.metric : 0},
                ${project.type === 'free' ? project.metric : 0},
                ${project.type === 'paid' ? project.metric : null},
                ${meta.description}, ${meta.imageUrl}, ${meta.status}, ${new Date()}, 'active')
      `;
    });
    created += 1;
  }

  const [left] = await sql<{ count: string }[]>`
    select count(*) from projects where url like ${PLACEHOLDER_URL}
  `;
  console.log(
    `\nОбновлено ${updated}, создано ${created}. Осталось строк-заглушек: ${left!.count}`,
  );
} finally {
  await sql.end();
}
