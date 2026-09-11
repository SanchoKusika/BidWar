import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { localeFromCode, renderNotification } from './notify_text.ts';

// Разряды в сообщении бота разделены неразрывным пробелом: в Telegram сумма не
// имеет права переехать на вторую строку половиной. В приложении для этого
// стоит тонкий пробел — там перенос и так невозможен.
const NBSP = ' ';

Deno.test('язык берётся по первой части кода, незнакомый — английский', () => {
  assertEquals(localeFromCode('ru-RU'), 'RU');
  assertEquals(localeFromCode('uz'), 'UZ');
  assertEquals(localeFromCode('de'), 'EN');
  assertEquals(localeFromCode(null), 'EN');
});

Deno.test('одиночная атака называет атакующего и падение', () => {
  const text = renderNotification(
    {
      kind: 'attacked',
      payload: {
        project_name: 'Mebel',
        attacker: 'beta',
        amount: 150000,
        count: 1,
        rank_before: 1,
        rank_after: 3,
      },
    },
    'EN',
  );

  assertStringIncludes(text!, 'beta');
  assertStringIncludes(text!, `150${NBSP}000`);
  assertStringIncludes(text!, 'from #1 to #3');
});

Deno.test('серия атак говорит про серию, а не про последний удар', () => {
  const text = renderNotification(
    {
      kind: 'attacked',
      payload: {
        project_name: 'Mebel',
        attacker: 'beta',
        amount: 450000,
        count: 3,
        rank_before: 1,
        rank_after: 4,
      },
    },
    'EN',
  );

  assertStringIncludes(text!, 'attacked 3 times');
  assertStringIncludes(text!, `450${NBSP}000`, 'сумма складывается за всё окно');
});

Deno.test('удар, не сдвинувший позицию, не врёт про падение', () => {
  const text = renderNotification(
    {
      kind: 'attacked',
      payload: {
        project_name: 'Mebel',
        attacker: 'beta',
        amount: 50000,
        count: 1,
        rank_before: 2,
        rank_after: 2,
      },
    },
    'EN',
  );

  assertStringIncludes(text!, 'holding at #2');
});

Deno.test('сообщение обращается к человеку, а не рассказывает о нём', () => {
  const attacked = renderNotification(
    {
      kind: 'attacked',
      payload: { project_name: 'Mebel', attacker: '@beta', amount: 50000, count: 1 },
    },
    'EN',
  );
  const lost = renderNotification(
    {
      kind: 'rank_lost',
      payload: { project_name: 'Mebel', top: 'paid', held_seconds: 3600, winner: '@gamma' },
    },
    'EN',
  );

  assertStringIncludes(attacked!, 'attacked you');
  assertStringIncludes(lost!, 'You are no longer #1');
});

Deno.test('потеря места несёт корону, срок удержания и того, кто занял', () => {
  const text = renderNotification(
    {
      kind: 'rank_lost',
      payload: {
        project_name: 'Mebel',
        top: 'paid',
        held_seconds: 367200,
        winner: '@gamma',
      },
    },
    'EN',
  );

  assertStringIncludes(text!, '👑');
  assertStringIncludes(text!, '4 d 6 h');
  assertStringIncludes(text!, 'Paid Top');
  assertStringIncludes(text!, '@gamma took the spot');
});

Deno.test('неизвестный победитель не даёт оборванной фразы', () => {
  const text = renderNotification(
    { kind: 'rank_lost', payload: { project_name: 'Mebel', top: 'free', held_seconds: 900 } },
    'EN',
  );

  assertStringIncludes(text!, '15 min');
  assertStringIncludes(text!, 'Free Top');
  assertEquals(text!.includes('took the spot'), false, 'без имени строки про него нет вовсе');
});

Deno.test('дайджест голосов считает отдачи, а не людей', () => {
  const text = renderNotification(
    { kind: 'votes', payload: { project_name: 'Mebel', amount: 12, count: 3 } },
    'EN',
  );

  assertStringIncludes(text!, '+12 votes');
  assertStringIncludes(text!, '3 separate votes');
  // count — число слившихся событий: один человек мог отдать все три раза.
  assertEquals(text!.includes('people'), false, 'число отдач не выдаётся за число людей');
});

Deno.test('одна отдача не приписывает себе количество', () => {
  const text = renderNotification(
    { kind: 'votes', payload: { project_name: 'Mebel', amount: 4, count: 1 } },
    'EN',
  );

  assertEquals(text, '🗳 Your project "Mebel" got +4 votes.');
});

Deno.test('приглашённые: один и несколько — разные фразы', () => {
  const one = renderNotification({ kind: 'referral', payload: { amount: 3, count: 1 } }, 'EN');
  const many = renderNotification({ kind: 'referral', payload: { amount: 9, count: 3 } }, 'EN');

  assertStringIncludes(one!, 'someone you invited');
  assertStringIncludes(many!, '3 people you invited');
});

Deno.test('три языка дают три разных текста', () => {
  const payload = { project_name: 'Mebel', top: 'paid', held_seconds: 7200 };
  const ru = renderNotification({ kind: 'rank_lost', payload }, 'RU');
  const uz = renderNotification({ kind: 'rank_lost', payload }, 'UZ');
  const en = renderNotification({ kind: 'rank_lost', payload }, 'EN');

  assertEquals(new Set([ru, uz, en]).size, 3);
});

Deno.test('неизвестный вид не превращается в пустое сообщение', () => {
  assertEquals(renderNotification({ kind: 'whatever', payload: {} }, 'EN'), null);
});
