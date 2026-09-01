import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  attackFloor,
  attackRoom,
  creditedPoints,
  haircutBp,
  parseAttackLimits,
  type AttackLimits,
} from './attack.ts';

/** Дефолты из init_schema — те же, что засеяны в app_config.paid_limits. */
const RAW = {
  min_paid_amount: 50000,
  min_attack_amount: 10000,
  max_attacks_per_target_per_day: 3,
  max_attacks_total_per_day: 10,
  attack_floor_pct_of_initial: 50,
  attack_haircut_floor_pct: 50,
  attack_haircut_step_pct: 15,
  attack_haircut_reset_hours: 48,
};

const LIMITS: AttackLimits = parseAttackLimits(RAW);

Deno.test('parseAttackLimits: разбирает засеянный конфиг как есть', () => {
  assertEquals(LIMITS, {
    minPaidAmount: 50000,
    minAttackAmount: 10000,
    maxAttacksPerTargetPerDay: 3,
    maxAttacksTotalPerDay: 10,
    attackFloorPctOfInitial: 50,
    attackHaircutFloorPct: 50,
    attackHaircutStepPct: 15,
    attackHaircutResetHours: 48,
  });
});

Deno.test('parseAttackLimits: пропавший ключ — ошибка, а не молчаливый дефолт', () => {
  const { attack_haircut_step_pct: _, ...broken } = RAW;
  assertThrows(() => parseAttackLimits(broken), Error, 'attack_haircut_step_pct');
});

Deno.test('parseAttackLimits: процент выше 100 отвергается', () => {
  assertThrows(
    () => parseAttackLimits({ ...RAW, attack_floor_pct_of_initial: 150 }),
    Error,
    'attack_floor_pct_of_initial',
  );
});

Deno.test('parseAttackLimits: дробное значение отвергается', () => {
  assertThrows(
    () => parseAttackLimits({ ...RAW, attack_haircut_step_pct: 15.5 }),
    Error,
    'attack_haircut_step_pct',
  );
});

Deno.test('floor считается от начальной ставки, а не от текущей', () => {
  const target = { paidAmount: 5_000_000, initialStake: 4_000_000 };
  assertEquals(attackFloor(target, LIMITS), 2_000_000);
});

Deno.test('floor не опускается ниже минимальной ставки', () => {
  // 50% от 60 000 — это 30 000, что ниже минимума входа в топ.
  const target = { paidAmount: 60_000, initialStake: 60_000 };
  assertEquals(attackFloor(target, LIMITS), 50_000);
});

Deno.test('пустой initial_stake — считаем от текущей ставки, то есть строже', () => {
  const target = { paidAmount: 5_000_000, initialStake: null };
  assertEquals(attackFloor(target, LIMITS), 2_500_000);
});

Deno.test('room — расстояние от текущей ставки до пола', () => {
  const target = { paidAmount: 5_000_000, initialStake: 4_000_000 };
  assertEquals(attackRoom(target, LIMITS), { floor: 2_000_000, room: 3_000_000 });
});

Deno.test('упёршийся в пол проект уже не атакуется: room = 0', () => {
  const target = { paidAmount: 2_000_000, initialStake: 4_000_000 };
  assertEquals(attackRoom(target, LIMITS).room, 0);
});

Deno.test('room не уходит в минус, если ставка уже ниже пола', () => {
  // Пол вырос вслед за минимумом в конфиге — цель оказалась под ним.
  const target = { paidAmount: 40_000, initialStake: 40_000 };
  assertEquals(attackRoom(target, LIMITS).room, 0);
});

Deno.test('хейркат: первая атака по цели — 100%, дальше шаг вниз', () => {
  assertEquals(haircutBp(0, LIMITS), 10000);
  assertEquals(haircutBp(1, LIMITS), 8500);
  assertEquals(haircutBp(2, LIMITS), 7000);
  assertEquals(haircutBp(3, LIMITS), 5500);
});

Deno.test('хейркат не падает ниже своего пола', () => {
  assertEquals(haircutBp(4, LIMITS), 5000);
  assertEquals(haircutBp(100, LIMITS), 5000);
});

Deno.test('зачисление усекается, а не округляется вверх', () => {
  // 33 333 × 85% = 28 333.05 — лишнее очко атакующему не дарим.
  assertEquals(creditedPoints(33_333, 8500), 28_333);
});

Deno.test('зачисление целых процентов не теряет единиц на дробной арифметике', () => {
  // 1 - 0.15*3 в double даёт 0.55000000000000004; в базисных пунктах — ровно 5500.
  assertEquals(creditedPoints(1_000_000, haircutBp(3, LIMITS)), 550_000);
});

Deno.test('пример из 01 Механики сходится до единицы', () => {
  const alphaInitial = 4_000_000;
  let alpha = 5_000_000;
  let beta = 4_800_000;
  const amount = 100_000;

  const first = attackRoom({ paidAmount: alpha, initialStake: alphaInitial }, LIMITS);
  const landed1 = Math.min(amount, first.room);
  const credited1 = creditedPoints(landed1, haircutBp(0, LIMITS));
  alpha -= landed1;
  beta += credited1;
  assertEquals([alpha, beta], [4_900_000, 4_900_000]);

  const second = attackRoom({ paidAmount: alpha, initialStake: alphaInitial }, LIMITS);
  const landed2 = Math.min(amount, second.room);
  const credited2 = creditedPoints(landed2, haircutBp(1, LIMITS));
  alpha -= landed2;
  beta += credited2;
  assertEquals(credited2, 85_000);
  assertEquals([alpha, beta], [4_800_000, 4_985_000]);
});
