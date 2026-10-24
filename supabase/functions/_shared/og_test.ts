import { assertEquals } from 'jsr:@std/assert@1';
import {
  parseOgHtml,
  pickAvatar,
  telegramUserpic,
  withoutInstagramLoginWall,
  type PageCard,
} from './og.ts';
import type { ImageSize } from './image_size.ts';

const BASE = 'https://example.com/page';

/** The fields a card is read for, without its icon list. */
const text = (html: string, url = BASE) => {
  const { name, description, socialImage } = parseOgHtml(html, url);
  return { name, description, socialImage };
};

Deno.test('og:* выигрывает у всех остальных источников', () => {
  const html = `
    <head>
      <title>Заголовок из title</title>
      <meta property="og:title" content="Из og">
      <meta name="description" content="Из name">
      <meta property="og:description" content="Из og:description">
      <meta property="og:image" content="https://cdn.example.com/a.jpg">
    </head>`;

  assertEquals(text(html), {
    name: 'Из og',
    description: 'Из og:description',
    socialImage: 'https://cdn.example.com/a.jpg',
  });
});

Deno.test('без og:description берётся <meta name="description">', () => {
  // Обычный сайт без Open Graph: описание под ссылкой в карточке — это то же
  // самое, что показывает поисковик, то есть name="description".
  const html = `
    <head>
      <title>Мебель Савдо</title>
      <meta name="description" content="Мебель на заказ в Ташкенте">
    </head>`;

  assertEquals(text(html), {
    name: 'Мебель Савдо',
    description: 'Мебель на заказ в Ташкенте',
    socialImage: null,
  });
});

Deno.test('twitter:* — промежуточный запасной вариант между og и name', () => {
  const html = `
    <head>
      <meta name="twitter:title" content="Из twitter">
      <meta name="twitter:description" content="Описание из twitter">
      <meta name="twitter:image" content="/img/card.png">
      <meta name="description" content="Из name">
    </head>`;

  assertEquals(text(html), {
    name: 'Из twitter',
    description: 'Описание из twitter',
    socialImage: 'https://example.com/img/card.png',
  });
});

Deno.test('атрибуты в обратном порядке и одинарные кавычки', () => {
  const html = `<meta content='Описание задом наперёд' name='description'>`;
  assertEquals(parseOgHtml(html, BASE).description, 'Описание задом наперёд');
});

Deno.test('соседний мета-тег с более длинным именем не подменяет искомый', () => {
  // og:image:width стоит раньше og:image — совпадение по префиксу дало бы "600".
  const html = `
    <meta property="og:image:width" content="600">
    <meta property="og:image" content="https://cdn.example.com/real.jpg">`;
  assertEquals(parseOgHtml(html, BASE).socialImage, 'https://cdn.example.com/real.jpg');
});

Deno.test('пустой content не считается найденным описанием', () => {
  const html = `
    <meta property="og:description" content="">
    <meta name="description" content="Настоящее описание">`;
  assertEquals(parseOgHtml(html, BASE).description, 'Настоящее описание');
});

Deno.test('переносы строк в описании схлопываются в пробелы', () => {
  // Так выглядит «О себе» канала t.me и описание канала YouTube.
  const html = `<meta property="og:description" content="Первая строка\n\nвторая строка">`;
  assertEquals(parseOgHtml(html, BASE).description, 'Первая строка вторая строка');
});

Deno.test('HTML-сущности разворачиваются в имени и описании', () => {
  const html = `
    <meta property="og:title" content="Rock &amp; Roll">
    <meta property="og:description" content="&quot;Лучший&quot; канал &#8212; и &#x2014;">`;
  const parsed = parseOgHtml(html, BASE);
  assertEquals(parsed.name, 'Rock & Roll');
  assertEquals(parsed.description, '"Лучший" канал — и —');
});

Deno.test('сущности разворачиваются и в ссылках на картинки', () => {
  // Без этого `&amp;` уходил в адрес как есть, и подписанная ссылка LinkedIn
  // отвечала 403 — карточка показывала букву вместо логотипа.
  const html = `
    <meta property="og:image" content="https://media.example.com/logo?e=1&amp;t=abc">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png?w=180&amp;h=180">`;
  const parsed = parseOgHtml(html, BASE);
  assertEquals(parsed.socialImage, 'https://media.example.com/logo?e=1&t=abc');
  assertEquals(parsed.icons[0], 'https://example.com/favicon.png?w=180&h=180');
});

Deno.test('иконки: крупные растровые первыми, SVG после них, mask-icon не иконка', () => {
  const html = `
    <link rel="icon" href="/favicon-16.png" sizes="16x16">
    <link rel="mask-icon" href="/pinned.svg" color="#000">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="apple-touch-icon" href="/touch.png">
    <link rel=icon href=/icon-192.png sizes=192x192>`;
  assertEquals(parseOgHtml(html, BASE).icons, [
    'https://example.com/icon-192.png',
    'https://example.com/touch.png',
    // Not linked, but served by plenty of sites.
    'https://example.com/apple-touch-icon.png',
    'https://example.com/favicon.svg',
    // An unlinked /favicon.ico is often bigger than a declared 16 px one
    // (slack.com's holds 256 px).
    'https://example.com/favicon.ico',
    'https://example.com/favicon-16.png',
  ]);
});

Deno.test('rel="shortcut icon" тоже считается иконкой', () => {
  const html = `<link rel="shortcut icon" href="/fav.ico">`;
  assertEquals(parseOgHtml(html, BASE).icons.includes('https://example.com/fav.ico'), true);
});

Deno.test('нет ни одной иконки в разметке — догадки от корня сайта', () => {
  assertEquals(parseOgHtml('<head></head>', 'https://example.com/deep/page?x=1').icons, [
    'https://example.com/apple-touch-icon.png',
    'https://example.com/favicon.ico',
  ]);
});

Deno.test('нет ничего — имя по хосту, описания и картинки нет', () => {
  assertEquals(text('<head></head>'), {
    name: 'example.com',
    description: null,
    socialImage: null,
  });
});

Deno.test('Telegram: постоянный адрес аватарки по юзернейму', () => {
  const pic = (name: string) => `https://t.me/i/userpic/320/${name}.jpg`;
  assertEquals(telegramUserpic('https://t.me/durov'), pic('durov'));
  assertEquals(telegramUserpic('https://t.me/s/durov'), pic('durov'));
  assertEquals(telegramUserpic('https://t.me/durov/123'), pic('durov'));
  assertEquals(telegramUserpic('https://telegram.me/BotFather'), pic('BotFather'));
  assertEquals(telegramUserpic('https://durov.t.me/'), pic('durov'));
  assertEquals(telegramUserpic('https://t.me/gif'), pic('gif'));
  // No public username behind these: an invite, a private chat, a service page.
  assertEquals(telegramUserpic('https://t.me/+AbCdEf123'), null);
  assertEquals(telegramUserpic('https://t.me/joinchat/AbCdEf'), null);
  assertEquals(telegramUserpic('https://t.me/c/123456/7'), null);
  assertEquals(telegramUserpic('https://example.com/durov'), null);
});

// ── pickAvatar on a stubbed network ─────────────────────────────────────────

const square = (side: number): ImageSize => ({ width: side, height: side, vector: false });
const banner: ImageSize = { width: 1200, height: 630, vector: false };
const svg: ImageSize = { width: 512, height: 512, vector: true };

const GOOGLE = 'https://www.google.com/s2/favicons?domain=example.com&sz=128';

function stub(sizes: Record<string, ImageSize | null>) {
  const asked: string[] = [];
  const probe = (url: string) => {
    asked.push(url);
    return Promise.resolve(sizes[url] ?? null);
  };
  return { probe, asked };
}

function card(socialImage: string | null, icons: string[]): PageCard {
  return { name: 'x', description: null, socialImage, icons };
}

Deno.test('сайт: своя иконка вместо баннера og:image', async () => {
  const { probe } = stub({
    'https://example.com/og.png': banner,
    'https://example.com/touch.png': square(180),
    'https://example.com/favicon.ico': square(32),
    [GOOGLE]: square(128),
  });
  const page = card('https://example.com/og.png', [
    'https://example.com/touch.png',
    'https://example.com/favicon.ico',
  ]);
  assertEquals(await pickAvatar(page, BASE, probe), 'https://example.com/touch.png');
});

Deno.test('сайт: объявленная иконка-страница пропускается, берётся следующая', async () => {
  // sentry.io: /apple-touch-icon.png отвечает 200 и HTML — проба вернёт null.
  const { probe } = stub({ 'https://example.com/favicon.ico': square(48) });
  const page = card(null, [
    'https://example.com/apple-touch-icon.png',
    'https://example.com/favicon.ico',
  ]);
  assertEquals(await pickAvatar(page, BASE, probe), 'https://example.com/favicon.ico');
});

Deno.test('сайт: только мелкие иконки — копия иконки у Google', async () => {
  const { probe } = stub({ 'https://example.com/favicon.ico': square(16), [GOOGLE]: square(128) });
  const page = card('https://example.com/og.png', ['https://example.com/favicon.ico']);
  assertEquals(await pickAvatar(page, BASE, probe), GOOGLE);
});

Deno.test('сайт: SVG-иконка лучше, чем идти к Google', async () => {
  const { probe } = stub({ 'https://example.com/favicon.svg': svg, [GOOGLE]: square(128) });
  const page = card(null, ['https://example.com/favicon.svg']);
  assertEquals(await pickAvatar(page, BASE, probe), 'https://example.com/favicon.svg');
});

Deno.test('сайт: квадратный og:image сильнее мелкой иконки', async () => {
  // texnomart.uz кладёт в og:image свой логотип 640×640.
  const { probe } = stub({
    'https://example.com/logo.png': square(640),
    'https://example.com/favicon.ico': square(16),
  });
  const page = card('https://example.com/logo.png', ['https://example.com/favicon.ico']);
  assertEquals(await pickAvatar(page, BASE, probe), 'https://example.com/logo.png');
});

Deno.test('сайт: кроме баннера ничего нет — баннер, а не пусто', async () => {
  const { probe } = stub({ 'https://example.com/og.png': banner });
  const page = card('https://example.com/og.png', ['https://example.com/favicon.ico']);
  assertEquals(await pickAvatar(page, BASE, probe), 'https://example.com/og.png');
});

Deno.test('сайт: ни одна картинка не показывается браузеру — картинки нет', async () => {
  // click.uz: every image answers «Cross-Origin-Resource-Policy: same-site»,
  // so each probe says null — a stored address would only fail in the card.
  const { probe } = stub({});
  const page = card('https://example.com/og.png', ['https://example.com/apple-touch-icon.png']);
  assertEquals(await pickAvatar(page, BASE, probe), null);
});

Deno.test('профиль на платформе: квадратный og:image — это лицо, а не иконка сайта', async () => {
  const { probe } = stub({
    'https://avatars.githubusercontent.com/u/1': square(460),
    'https://github.com/fluidicon.png': square(512),
  });
  const page = card('https://avatars.githubusercontent.com/u/1', [
    'https://github.com/fluidicon.png',
  ]);
  assertEquals(
    await pickAvatar(page, 'https://github.com/gaearon', probe),
    'https://avatars.githubusercontent.com/u/1',
  );
  // The platform's own front page is a site: its banner loses to its icon.
  const { probe: front } = stub({
    'https://github.com/og.png': banner,
    'https://github.com/fluidicon.png': square(512),
  });
  const home = card('https://github.com/og.png', ['https://github.com/fluidicon.png']);
  assertEquals(
    await pickAvatar(home, 'https://github.com/', front),
    'https://github.com/fluidicon.png',
  );
});

Deno.test('Telegram: адрес по юзернейму, без единого запроса', async () => {
  const { probe, asked } = stub({});
  const page = card('https://cdn4.telesco.pe/file/expiring.jpg', []);
  assertEquals(
    await pickAvatar(page, 'https://t.me/durov', probe),
    'https://t.me/i/userpic/320/durov.jpg',
  );
  assertEquals(asked, []);
});

/** What Instagram serves a cloud address instead of the profile (24.10.2026). */
const INSTAGRAM_WALL = `
  <head>
    <title>Instagram</title>
    <meta property="og:title" content="Instagram">
    <meta property="og:description" content="Create an account or log in to Instagram - Share what you're into with the people who get you.">
    <meta property="og:image" content="https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png">
  </head>`;

Deno.test('Instagram: страница входа — имя из ссылки, без описания, логотип остаётся', () => {
  const url = 'https://www.instagram.com/kuznetsovsgallery/';
  const { name, description, socialImage } = withoutInstagramLoginWall(
    parseOgHtml(INSTAGRAM_WALL, url),
    url,
  );
  assertEquals(
    { name, description, socialImage },
    {
      name: '@kuznetsovsgallery',
      description: null,
      socialImage: 'https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png',
    },
  );
});

Deno.test('Instagram: настоящий профиль не трогается', () => {
  const url = 'https://www.instagram.com/kuznetsovsgallery/';
  const html = `
    <head>
      <meta property="og:title" content="Kuznetsovs Gallery (@kuznetsovsgallery)">
      <meta property="og:description" content="5,493 Followers, 365 Posts">
    </head>`;
  const page = parseOgHtml(html, url);
  assertEquals(withoutInstagramLoginWall(page, url), page);
});

Deno.test('Instagram: пост и служебные страницы не превращаются в имя', () => {
  for (const url of [
    'https://www.instagram.com/',
    'https://www.instagram.com/p/C1a2b3/',
    'https://www.instagram.com/accounts/login/',
  ]) {
    const page = parseOgHtml(INSTAGRAM_WALL, url);
    assertEquals(withoutInstagramLoginWall(page, url), page, url);
  }
});

Deno.test('Instagram: сайт с названием «Instagram» на другом домене не трогается', () => {
  const page = parseOgHtml(INSTAGRAM_WALL, BASE);
  assertEquals(withoutInstagramLoginWall(page, BASE), page);
});
