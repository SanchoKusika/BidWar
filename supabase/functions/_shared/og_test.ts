import { assertEquals } from 'jsr:@std/assert@1';
import { parseOgHtml } from './og.ts';

const BASE = 'https://example.com/page';

Deno.test('og:* выигрывает у всех остальных источников', () => {
  const html = `
    <head>
      <title>Заголовок из title</title>
      <meta property="og:title" content="Из og">
      <meta name="description" content="Из name">
      <meta property="og:description" content="Из og:description">
      <meta property="og:image" content="https://cdn.example.com/a.jpg">
    </head>`;

  assertEquals(parseOgHtml(html, BASE), {
    name: 'Из og',
    description: 'Из og:description',
    imageUrl: 'https://cdn.example.com/a.jpg',
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

  assertEquals(parseOgHtml(html, BASE), {
    name: 'Мебель Савдо',
    description: 'Мебель на заказ в Ташкенте',
    imageUrl: null,
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

  assertEquals(parseOgHtml(html, BASE), {
    name: 'Из twitter',
    description: 'Описание из twitter',
    imageUrl: 'https://example.com/img/card.png',
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
  assertEquals(parseOgHtml(html, BASE).imageUrl, 'https://cdn.example.com/real.jpg');
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

Deno.test('нет ничего — имя по хосту, описание и картинка пустые', () => {
  assertEquals(parseOgHtml('<head></head>', BASE), {
    name: 'example.com',
    description: null,
    imageUrl: null,
  });
});

Deno.test('HTML-сущности разворачиваются в имени и описании', () => {
  const html = `
    <meta property="og:title" content="Rock &amp; Roll">
    <meta property="og:description" content="&quot;Лучший&quot; канал">`;
  const parsed = parseOgHtml(html, BASE);
  assertEquals(parsed.name, 'Rock & Roll');
  assertEquals(parsed.description, '"Лучший" канал');
});
