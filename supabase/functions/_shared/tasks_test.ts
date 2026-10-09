import { assertEquals } from 'jsr:@std/assert@1';
import { buildTaskBoard, nextReferralGoal, type CompletionRow, type TaskRow } from './tasks.ts';

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
  paidProjects: 3,
  visitPerDay: 10,
  referralMilestones: [1, 3, 5, 10],
  referralStep: 10,
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

Deno.test('referral: первая цель — один друг', () => {
  const [item] = buildTaskBoard([task(2, 'referral', 3)], [], ctx());
  assertEquals(item.state, 'available');
  assertEquals(item.progress, { current: 0, total: 1 });
});

Deno.test('referral: достигнутая цель сменяется следующей', () => {
  const [one] = buildTaskBoard([task(2, 'referral', 3)], [done(2)], ctx());
  assertEquals(one.progress, { current: 1, total: 3 });
  const [three] = buildTaskBoard([task(2, 'referral', 3)], [done(2), done(2), done(2)], ctx());
  assertEquals(three.progress, { current: 3, total: 5 });
  assertEquals(three.state, 'available', 'пригласить можно ещё — задание не закрывается');
});

Deno.test('referral: после последней ступени цель растёт шагом', () => {
  const milestones = [1, 3, 5, 10];
  assertEquals(nextReferralGoal(9, milestones, 10), 10);
  assertEquals(nextReferralGoal(10, milestones, 10), 20);
  assertEquals(nextReferralGoal(19, milestones, 10), 20);
  assertEquals(nextReferralGoal(20, milestones, 10), 30);
});

Deno.test('subscribe: засчитывается навсегда', () => {
  const rows = [done(3)];
  const [before] = buildTaskBoard([task(3, 'subscribe', 2)], [], ctx());
  const [after] = buildTaskBoard([task(3, 'subscribe', 2)], rows, ctx());
  assertEquals(before.state, 'available');
  assertEquals(after.state, 'done');
  assertEquals(after.targetProjectId, 42);
  assertEquals(after.targetUrl, null, 'ссылки в строке нет — значит и в ответе null');
});

Deno.test('чужие выполненные задания состояние не двигают', () => {
  const [item] = buildTaskBoard([task(1, 'visit')], [done(2, TODAY)], ctx());
  assertEquals(item.progress, { current: 0, total: 3 });
});

// Цель — предел из конфига, но не больше, чем проектов на витрине: обещать
// десять там, где их три, значит рисовать полосу, которую не закрыть.
Deno.test('visit: цель — меньшее из предела и числа проектов', () => {
  const many = buildTaskBoard([task(1, 'visit')], [], ctx({ paidProjects: 18 }))[0];
  assertEquals(many.progress, { current: 0, total: 10 });

  const few = buildTaskBoard([task(1, 'visit')], [], ctx({ paidProjects: 3 }))[0];
  assertEquals(few.progress, { current: 0, total: 3 });
});

Deno.test('visit: десять переходов из восемнадцати проектов — выполнено', () => {
  const rows = Array.from({ length: 10 }, () => done(1, TODAY));
  const [item] = buildTaskBoard([task(1, 'visit')], rows, ctx({ paidProjects: 18 }));
  assertEquals(item.state, 'done');
  assertEquals(item.progress, { current: 10, total: 10 });
});
