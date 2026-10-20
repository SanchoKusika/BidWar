import { assertEquals } from 'jsr:@std/assert@1';
import {
  buildTaskBoard,
  nextReferralGoal,
  type CompletionRow,
  type ProgressRow,
  type TaskRow,
} from './tasks.ts';

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

// ---------------------------------------------------------------------------
// Newer tasks: state from task_progress, layout from the type
// ---------------------------------------------------------------------------

const progressRow = (taskId: number, over: Partial<ProgressRow> = {}): ProgressRow => ({
  task_id: taskId,
  state: 'available',
  current_value: null,
  goal: null,
  reward: 1,
  target_project_id: null,
  ...over,
});

Deno.test('a newer task without a task_progress row is hidden', () => {
  const board = buildTaskBoard([task(1, 'visit'), task(2, 'boost')], [], ctx(), []);
  assertEquals(
    board.map((item) => item.type),
    ['visit'],
  );
});

Deno.test('a type this build does not know is left out', () => {
  const board = buildTaskBoard([task(1, 'visit'), task(2, 'from_the_future')], [], ctx());
  assertEquals(board.length, 1);
});

Deno.test('a ladder takes the reward and goal of its current step', () => {
  const [item] = buildTaskBoard([task(5, 'ladder_votes', 2)], [], ctx(), [
    progressRow(5, { state: 'ready', current_value: 50, goal: 50, reward: 5 }),
  ]);
  assertEquals(item?.state, 'ready');
  assertEquals(item?.rewardVotes, 5, 'the step pays 5, not the row first 2');
  assertEquals(item?.progress, { current: 50, total: 50 });
  assertEquals(item?.group, 'goal');
});

Deno.test('a one-time task without a goal has no progress bar', () => {
  const [item] = buildTaskBoard([task(7, 'bot_dm', 2)], [], ctx(), [progressRow(7)]);
  assertEquals(item?.progress, undefined);
  assertEquals(item?.group, 'once');
});

Deno.test('the daily bonus leads the day whatever its id', () => {
  const board = buildTaskBoard(
    [task(1, 'visit'), task(3, 'subscribe'), task(9, 'daily_checkin')],
    [],
    ctx(),
    [progressRow(9, { state: 'ready', current_value: 1, goal: 7 })],
  );
  assertEquals(
    board.map((item) => item.type),
    ['daily_checkin', 'visit', 'subscribe'],
  );
});

Deno.test('an unknown state from SQL falls back to available', () => {
  const [item] = buildTaskBoard([task(4, 'premium')], [], ctx(), [
    progressRow(4, { state: 'bogus' }),
  ]);
  assertEquals(item?.state, 'available');
});
