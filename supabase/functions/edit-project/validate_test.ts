import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { parseEditRequest } from './validate.ts';

const base = { initData: 'x', projectId: 7 };

Deno.test('название и описание сворачиваются в одну строку', () => {
  assertEquals(
    parseEditRequest({
      ...base,
      name: '  Kuznetsovs\n Gallery ',
      description: 'Картины\n\nдля  интерьера',
    }),
    {
      initData: 'x',
      projectId: 7,
      name: 'Kuznetsovs Gallery',
      description: 'Картины для интерьера',
    },
  );
});

Deno.test('пустое описание — его нет, а не пустая строка', () => {
  assertEquals(parseEditRequest({ ...base, name: 'A', description: '   ' }).description, null);
  assertEquals(parseEditRequest({ ...base, name: 'A', description: null }).description, null);
  assertEquals(parseEditRequest({ ...base, name: 'A' }).description, null);
});

Deno.test('пустое название отвергается', () => {
  assertThrows(() => parseEditRequest({ ...base, name: ' \n ' }));
  assertThrows(() => parseEditRequest({ ...base }));
});

Deno.test('длиннее, чем помещается в карточку, — отказ', () => {
  assertThrows(() => parseEditRequest({ ...base, name: 'a'.repeat(121) }));
  assertThrows(() => parseEditRequest({ ...base, name: 'A', description: 'a'.repeat(301) }));
  assertEquals(parseEditRequest({ ...base, name: 'a'.repeat(120) }).name.length, 120);
  assertEquals(
    parseEditRequest({ ...base, name: 'A', description: 'a'.repeat(300) }).description?.length,
    300,
  );
});

Deno.test('без initData и projectId — отказ', () => {
  assertThrows(() => parseEditRequest({ projectId: 7, name: 'A' }));
  assertThrows(() => parseEditRequest({ initData: 'x', name: 'A' }));
  assertThrows(() => parseEditRequest({ initData: 'x', projectId: 1.5, name: 'A' }));
});
