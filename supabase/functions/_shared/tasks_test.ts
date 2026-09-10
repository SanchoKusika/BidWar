import { assertEquals } from 'jsr:@std/assert@1';
import { buildTaskBoard, type CompletionRow, type TaskRow } from './tasks.ts';

const TODAY = '2026-09-10';

const task = (id: number, type: string, reward = 1): TaskRow => ({
  id,
  type,
  title: type,
  description: null,
  reward_votes: reward,
  target_project_id: type === 'subscribe' ? 42 : null,
});

const done = (taskId: number, day: string | null = null): CompletionRow => ({
  task_id: taskId,
  period_day: day,
});

const ctx = (over: Partial<Parameters<typeof buildTaskBoard>[2]> = {}) => ({
  today: TODAY,
  invited: 0,
  paidProjects: 3,
  ...over,
});

Deno.test('visit: ни одного захода за сутки — доступно, прогресс с нуля', () => {
  const [item] = buildTaskBoard([task(1, 'visit')], [], ctx());
  assertEquals(item.state, 'available');
  assertEquals(item.progress, { current: 0, total: 3 });
});

Deno.test('visit: вчерашние заходы сегодняшний прогресс не наполняют', () => {
  const [item] = buildTaskBoard([task(1, 'visit')], [done(1, '2026-09-09')], ctx());
  assertEquals(item.progress, { current: 0, total: 3 });
  assertEquals(item.state, 'available');
});

Deno.test('visit: часть проектов обойдена — всё ещё доступно', () => {
  const rows = [done(1, TODAY), done(1, TODAY)];
  const [item] = buildTaskBoard([task(1, 'visit')], rows, ctx());
  assertEquals(item.progress, { current: 2, total: 3 });
  assertEquals(item.state, 'available');
});

Deno.test('visit: обойдены все — выполнено до конца суток', () => {
  const rows = [done(1, TODAY), done(1, TODAY), done(1, TODAY)];
  const [item] = buildTaskBoard([task(1, 'visit')], rows, ctx());
  assertEquals(item.state, 'done');
});

// Пустая витрина: обходить нечего, и «выполнено» тут значило бы, что человек
// что-то сделал. Задание остаётся доступным, прогресс — 0 из 0.
Deno.test('visit: платных проектов нет — задание не выполнено', () => {
  const [item] = buildTaskBoard([task(1, 'visit')], [], ctx({ paidProjects: 0 }));
  assertEquals(item.state, 'available');
  assertEquals(item.progress, { current: 0, total: 0 });
});

Deno.test('referral: никого не пригласил — прогресса нет вовсе', () => {
  const [item] = buildTaskBoard([task(2, 'referral', 3)], [], ctx());
  assertEquals(item.state, 'available');
  assertEquals(item.progress, undefined);
});

Deno.test('referral: прогресс — дошедшие до первого задания из всех пришедших', () => {
  const [item] = buildTaskBoard([task(2, 'referral', 3)], [done(2), done(2)], ctx({ invited: 5 }));
  assertEquals(item.progress, { current: 2, total: 5 });
  assertEquals(item.state, 'available', 'пригласить можно ещё — задание не закрывается');
});

Deno.test('subscribe: засчитывается навсегда', () => {
  const rows = [done(3)];
  const [before] = buildTaskBoard([task(3, 'subscribe', 2)], [], ctx());
  const [after] = buildTaskBoard([task(3, 'subscribe', 2)], rows, ctx());
  assertEquals(before.state, 'available');
  assertEquals(after.state, 'done');
  assertEquals(after.targetProjectId, 42);
});

Deno.test('чужие выполненные задания состояние не двигают', () => {
  const [item] = buildTaskBoard([task(1, 'visit')], [done(2, TODAY)], ctx());
  assertEquals(item.progress, { current: 0, total: 3 });
});
