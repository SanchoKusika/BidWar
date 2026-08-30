# Срез 1.5 — платёжный слой на моке и Raise: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** завести платёжный слой на моке и механику Raise — так, чтобы платный
вход и повышение ставки работали от кнопки в мини-аппе до записи в леджере, а
денежная логика была покрыта тестами.

**Architecture:** деньги двигает одна хранимка `apply_payment` (транзакция с
`FOR UPDATE`, блокировка строк по возрастанию `id`), поверх неё — интерфейс
`PaymentProvider` с единственной реализацией `MockPaymentProvider`,
подтверждающей платёж синхронно. Две Edge Functions: `create-payment` (валидация
и создание платежа) и `payment-webhook` (точка входа настоящих провайдеров,
готовая к срезу 1.10). Клиент вызывает `create-payment` и смотрит на `status` в
ответе — про мок он не знает.

**Tech Stack:** Deno + TypeScript (Edge Functions), PostgreSQL/plpgsql (хранимка),
React + TypeScript + CSS-модули (клиент), `deno test` (раннер).

**Spec:** `docs/superpowers/specs/2026-08-30-payment-layer-raise-design.md`

## Global Constraints

- **Сообщения коммитов — по-английски**, Conventional Commits. Комментарии в
  коде, документация и описания PR — по-русски. Трейлер `Co-Authored-By` не
  добавлять никогда.
- **Не работать напрямую в `main`:** ветка → коммиты → `gh pr create` →
  squash-мерж → удалить ветку.
- **Перед пушем — `npm run check`** (типы, линт, prettier, изоляция платформы,
  начиная с задачи 1 — ещё и `npm run test`). Состав обязан совпадать с CI.
- **Бизнес-правила живут на сервере.** Лимиты — в `app_config.paid_limits`,
  клиент читает их через `fetchPaidLimits` только для предпросмотра. Дублировать
  эти числа константами в клиенте нельзя.
- **FSD:** `app > pages > widgets > features > entities > shared`, нижний слой не
  импортирует верхний (проверяется `no-restricted-imports` в `eslint.config.js`).
- **Ничто вне `shared/platform` и `app/telegram` не трогает `window.Telegram`**
  (проверяется `scripts/check-platform-isolation.sh`).
- **Только CSS-модули, значения из токенов.** Инлайн-стиль допустим единственным
  способом — проброс динамического значения в CSS-переменную.
- **Денежные величины — целые.** `BIGINT` в очках, `NUMERIC(20,10)` для курсов,
  никаких `float`.
- **Edge Functions деплоятся руками.** `supabase` CLI на этой машине **не
  залогинен** (`supabase login` не выполнялся), поэтому рабочий путь —
  MCP-инструменты Supabase: `apply_migration` (миграции), `deploy_edge_function`
  (деплой), `generate_typescript_types` (типы), `execute_sql` (проверки). Пароля
  к базе они не требуют. Альтернатива — `supabase login` и CLI-команды.
- **`verify_jwt` при деплое** повторяет существующие функции: `true` у всего, что
  зовёт клиент (`auth`, `add-project`, `click`) и, значит, у `create-payment`;
  `false` у того, что зовёт внешняя сторона без JWT (`bot`) и, значит, у
  `payment-webhook`.
- **Ловушки, на которые уже наступали:** `react-hooks/set-state-in-effect` (сброс
  состояния при смене пропа — сравнением в рендере, не в эффекте),
  `react-hooks/refs` (не мутировать `.current` во время рендера),
  `noUncheckedIndexedAccess: true` (обращение по индексу даёт `T | undefined`).

## Структура файлов

| Файл                                              | За что отвечает                                 |
| ------------------------------------------------- | ----------------------------------------------- |
| `supabase/migrations/<ts>_payment_layer.sql`      | Расширение CHECK-ов и хранимка `apply_payment`  |
| `supabase/functions/_shared/payments/types.ts`    | Интерфейс `PaymentProvider` и типы платежа      |
| `supabase/functions/_shared/payments/fx.ts`       | Курсы из `app_config` и конвертация в очки      |
| `supabase/functions/_shared/payments/apply.ts`    | Обёртка над хранимкой `apply_payment`           |
| `supabase/functions/_shared/payments/mock.ts`     | `MockPaymentProvider`                           |
| `supabase/functions/_shared/payments/registry.ts` | Выбор провайдера по `PAYMENT_PROVIDER`          |
| `supabase/functions/create-payment/index.ts`      | Валидация, создание платежа, вызов провайдера   |
| `supabase/functions/create-payment/validate.ts`   | Чистые правила валидации (тестируются отдельно) |
| `supabase/functions/payment-webhook/index.ts`     | Точка входа вебхуков провайдеров                |
| `supabase/tests/apply_payment_test.ts`            | Интеграционные тесты хранимки (нужна БД)        |
| `src/features/raise/api.ts`                       | Вызов `create-payment` с клиента                |
| `src/features/raise/types.ts`                     | Типы запроса и ответа                           |
| `src/features/raise/index.ts`                     | Публичный экспорт фичи                          |
| `src/shared/content/payments.ts`                  | + мок-способ оплаты, честно подписанный         |
| `src/shared/config/preview.ts`                    | + флаг `mockPayments`                           |
| `src/pages/paid/ui/Mobile.tsx`                    | Подключение Raise и платного входа              |

---

## Task 1: Тестовый раннер и регрессионные тесты `initData`

Первая задача не пишет продуктового кода: она заводит раннер, без которого
остальные задачи не смогут идти через TDD. Тесты `initData` покрывают уже
написанный `verifyInitData` — это регрессия, а не TDD-цикл, и они пройдут с
первого запуска. Их ценность в том, что дальше этот код трогать будут вслепую.

**Files:**

- Modify: `package.json` (скрипты `test`, `check`)
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md` (раздел про команды)
- Test: `supabase/functions/_shared/telegram_test.ts`

**Interfaces:**

- Consumes: `verifyInitData(initData: string, botToken: string): Promise<VerifiedInitData | null>`
  из `supabase/functions/_shared/telegram.ts`
- Produces: команда `npm run test`, на которую опираются все следующие задачи

- [ ] **Step 1: Установить Deno**

На машине его нет (проверено). Установка не трогает репозиторий:

```bash
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"   # добавить в ~/.bashrc
deno --version
```

Ожидается: версия `2.x`.

- [ ] **Step 2: Написать тест, который пока некому запустить**

Создать `supabase/functions/_shared/telegram_test.ts`:

```ts
import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { verifyInitData } from './telegram.ts';

const BOT_TOKEN = 'test-token:AAAA';

/** Собирает подписанный initData так же, как это делает Telegram. */
async function signInitData(fields: Record<string, string>): Promise<string> {
  const params = new URLSearchParams(fields);
  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join('\n');

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secret = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(BOT_TOKEN));

  const signingKey = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(dataCheckString));
  const hash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  params.set('hash', hash);
  return params.toString();
}

const user = JSON.stringify({ id: 42, first_name: 'Test' });
const now = () => Math.floor(Date.now() / 1000);

Deno.test('валидный initData принимается и отдаёт пользователя', async () => {
  const initData = await signInitData({ user, auth_date: String(now()) });
  const result = await verifyInitData(initData, BOT_TOKEN);
  assertNotEquals(result, null);
  assertEquals(result?.user.id, 42);
});

Deno.test('подделанный initData отвергается', async () => {
  const initData = await signInitData({ user, auth_date: String(now()) });
  const forged = initData.replace(/first_name%22%3A%22Test/, 'first_name%22%3A%22Hack');
  assertEquals(await verifyInitData(forged, BOT_TOKEN), null);
});

Deno.test('initData без hash отвергается', async () => {
  assertEquals(await verifyInitData(`user=${encodeURIComponent(user)}`, BOT_TOKEN), null);
});

Deno.test('просроченный auth_date отвергается', async () => {
  const initData = await signInitData({ user, auth_date: String(now() - 60 * 60 * 25) });
  assertEquals(await verifyInitData(initData, BOT_TOKEN), null);
});
```

- [ ] **Step 3: Запустить и убедиться, что раннера ещё нет**

Run: `npm run test`
Expected: FAIL — `Missing script: "test"`.

- [ ] **Step 4: Завести скрипты**

В `package.json`, в `scripts`:

```json
"test": "deno test supabase/functions",
"check": "npm run typecheck && npm run lint && npm run format:check && npm run check:platform && npm run test"
```

- [ ] **Step 5: Запустить тесты**

Run: `npm run test`
Expected: PASS, 4 теста.

Если `verifyInitData` не проверяет свежесть `auth_date` в пределах суток —
поправить его, а не тест: требование зафиксировано в `05 Аккаунты и авторизация`.

- [ ] **Step 6: Исключить тесты из сборки фронта**

`tsc` не должен пытаться разбирать Deno-файлы. Проверить, что
`supabase/functions/**` не попадает в `tsconfig.app.json` (`include`), и что
prettier форматирует новый файл в общем стиле:

Run: `npm run typecheck && npx prettier --check supabase/functions/_shared/telegram_test.ts`
Expected: обе команды успешны.

- [ ] **Step 7: Добавить шаг в CI**

В `.github/workflows/ci.yml`, после `npm run check:platform` и до `npm run build`:

```yaml
- uses: denoland/setup-deno@v2
  with:
    deno-version: v2.x
- run: npm run test
```

`setup-deno` поставить сразу после `actions/setup-node`, чтобы шаг `npm run test`
нашёл бинарь.

- [ ] **Step 8: Прогнать check целиком**

Run: `npm run check`
Expected: все шаги зелёные, включая `test`.

- [ ] **Step 9: Записать команду в README**

В README, в раздел с командами, строкой рядом с остальными:

```markdown
| `npm run test` | тесты Edge Functions (`deno test`), требует установленного Deno |
```

- [ ] **Step 10: Коммит**

```bash
git checkout -b feat/slice-1-5-test-runner
git add package.json .github/workflows/ci.yml README.md supabase/functions/_shared/telegram_test.ts
git commit -m "test: add deno test runner and initData regression tests"
```

---

## Task 2: Миграция схемы и хранимка `apply_payment`

Сердце среза: единственное место, которое двигает деньги и очки. Тесты здесь
интеграционные — им нужна живая база.

**Как гонять БД-тесты без Docker.** Локального Supabase на машине нет (Docker не
установлен). Тесты подключаются к Postgres dev-проекта напрямую и оборачивают всё
в транзакцию с `ROLLBACK` — в базе не остаётся ни строки. Строка подключения
берётся из Supabase Dashboard → Project Settings → Database → Connection string
и кладётся в `.env` как `SUPABASE_DB_URL` (в `.env.example` — пустой).

**Files:**

- Create: `supabase/migrations/20260830120000_payment_layer.sql`
- Create: `supabase/tests/apply_payment_test.ts`
- Modify: `package.json` (скрипт `test:db`)
- Modify: `.env.example`
- Modify: `src/shared/api/database.types.ts` (генерируется)

**Interfaces:**

- Produces: rpc `apply_payment(p_payment_id uuid, p_provider_event_id text, p_confirmed boolean)`
  → `table (applied boolean, project_id bigint, points_granted bigint)`
- Produces: `projects.status` принимает `'pending_payment'`;
  `payment_transactions.provider` принимает `'mock'`

- [ ] **Step 1: Написать интеграционный тест**

Создать `supabase/tests/apply_payment_test.ts`:

```ts
import { assertEquals } from 'jsr:@std/assert@1';
import postgres from 'npm:postgres@3';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL не задан — см. план, задача 2');

/**
 * Каждый тест целиком внутри транзакции, которая всегда откатывается: база
 * общая с разработкой, и оставлять в ней мусор нельзя.
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

/** Пользователь, категория и платный проект в статусе pending_payment. */
async function seed(tx: postgres.TransactionSql, points: number) {
  const [user] = await tx`
    insert into users (display_name) values ('test') returning id`;
  const [category] = await tx`select id from categories order by sort_order limit 1`;
  const [project] = await tx`
    insert into projects (user_id, category_id, name, url, type, status)
    values (${user.id}, ${category.id}, 'T', ${'https://t.example/' + crypto.randomUUID()},
            'paid', 'pending_payment')
    returning id`;
  const [payment] = await tx`
    insert into payment_transactions
      (user_id, project_id, intent, provider, original_currency, original_amount,
       fx_rate_used, points_granted, status)
    values (${user.id}, ${project.id}, 'raise', 'mock', 'UZS', ${points}, 1, ${points}, 'pending')
    returning id`;
  return { userId: user.id, projectId: project.id, paymentId: payment.id };
}

Deno.test('подтверждение поднимает ставку и открывает проект', async () => {
  await inRollback(async (tx) => {
    const { projectId, paymentId } = await seed(tx, 100000);
    const [result] = await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    assertEquals(result.applied, true);
    assertEquals(Number(result.points_granted), 100000);

    const [project] = await tx`select * from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 100000);
    assertEquals(Number(project.initial_stake), 100000);
    assertEquals(project.status, 'active');

    const [ledger] = await tx`
      select coalesce(sum(amount), 0) as total from stake_transactions where project_id = ${projectId}`;
    assertEquals(Number(ledger.total), 100000, 'очки проекта = сумма его stake-транзакций');
  });
});

Deno.test('повторный вызов ничего не меняет', async () => {
  await inRollback(async (tx) => {
    const { projectId, paymentId } = await seed(tx, 100000);
    await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;
    const [second] = await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    assertEquals(second.applied, false);
    const [project] = await tx`select paid_amount from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 100000, 'вторая попытка не удвоила ставку');
    const [rows] = await tx`
      select count(*)::int as n from stake_transactions where payment_id = ${paymentId}`;
    assertEquals(rows.n, 1);
  });
});

Deno.test('отказ провайдера не начисляет очков и не открывает проект', async () => {
  await inRollback(async (tx) => {
    const { projectId, paymentId } = await seed(tx, 100000);
    const [result] = await tx`select * from apply_payment(${paymentId}, 'evt-1', false)`;

    assertEquals(result.applied, false);
    const [project] = await tx`select paid_amount, status from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 0);
    assertEquals(project.status, 'pending_payment');
    const [payment] = await tx`select status from payment_transactions where id = ${paymentId}`;
    assertEquals(payment.status, 'failed');
  });
});

Deno.test('initial_stake фиксируется первым платежом и не меняется вторым', async () => {
  await inRollback(async (tx) => {
    const { userId, projectId, paymentId } = await seed(tx, 100000);
    await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    const [second] = await tx`
      insert into payment_transactions
        (user_id, project_id, intent, provider, original_currency, original_amount,
         fx_rate_used, points_granted, status)
      values (${userId}, ${projectId}, 'raise', 'mock', 'UZS', 50000, 1, 50000, 'pending')
      returning id`;
    await tx`select * from apply_payment(${second.id}, 'evt-2', true)`;

    const [project] =
      await tx`select paid_amount, initial_stake from projects where id = ${projectId}`;
    assertEquals(Number(project.paid_amount), 150000);
    assertEquals(Number(project.initial_stake), 100000, 'база для floor — первая ставка');
  });
});

Deno.test('rank1_since переезжает к новому лидеру', async () => {
  await inRollback(async (tx) => {
    // Прежний лидер: ставка заведомо выше всего, что есть в базе.
    const [top] =
      await tx`select coalesce(max(paid_amount), 0) as v from projects where type = 'paid'`;
    const leaderBid = Number(top.v) + 1_000_000;

    const { userId: oldUser } = await seed(tx, 1);
    const [category] = await tx`select id from categories order by sort_order limit 1`;
    const [old] = await tx`
      insert into projects (user_id, category_id, name, url, type, status, paid_amount,
                            initial_stake, rank1_since)
      values (${oldUser}, ${category.id}, 'Old', ${'https://o.example/' + crypto.randomUUID()},
              'paid', 'active', ${leaderBid}, ${leaderBid}, now())
      returning id`;

    const { projectId, paymentId } = await seed(tx, leaderBid + 1);
    await tx`select * from apply_payment(${paymentId}, 'evt-1', true)`;

    const [winner] = await tx`select rank1_since from projects where id = ${projectId}`;
    const [loser] = await tx`select rank1_since from projects where id = ${old.id}`;
    assertEquals(winner.rank1_since !== null, true, 'новый лидер получил отметку');
    assertEquals(loser.rank1_since, null, 'у прежнего отметка снята');
  });
});
```

- [ ] **Step 2: Завести скрипт и запустить — тест обязан упасть**

В `package.json`:

```json
"test:db": "deno test --allow-env --allow-net --allow-read supabase/tests"
```

В `.env.example` добавить строку:

```
# Прямое подключение к Postgres — только для `npm run test:db` (см. план среза 1.5)
# SUPABASE_DB_URL=
```

Run: `set -a && . ./.env && set +a && npm run test:db`
Expected: FAIL — `function apply_payment(...) does not exist`.

- [ ] **Step 3: Написать миграцию**

Создать `supabase/migrations/20260830120000_payment_layer.sql`:

```sql
-- Срез 1.5. Проект живёт в pending_payment между созданием инвойса и его
-- подтверждением: строку нельзя завести после оплаты, потому что
-- payment_transactions.project_id объявлен not null. Все витрины, RLS и
-- уникальные индексы фильтруют по status = 'active', поэтому такой строки для
-- них не существует.
alter table projects drop constraint projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('active', 'pending_payment', 'hidden', 'blocked'));

alter table payment_transactions drop constraint payment_transactions_provider_check;
alter table payment_transactions add constraint payment_transactions_provider_check
  check (provider in ('mock', 'globalpay', 'platega', 'paddle', 'telegram_stars'));

-- Единственное место, которое двигает деньги и очки. В базе, а не в Edge
-- Function: supabase-js не умеет многооператорных транзакций, а здесь
-- обязательны FOR UPDATE и атомарность (02 Архитектура).
create or replace function apply_payment(
  p_payment_id        uuid,
  p_provider_event_id text,
  p_confirmed         boolean
)
returns table (applied boolean, project_id bigint, points_granted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment       payment_transactions%rowtype;
  v_leader_before bigint;
  v_leader_after  bigint;
  v_group         uuid := gen_random_uuid();
begin
  select * into v_payment from payment_transactions where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id;
  end if;

  -- Идемпотентность: платёж уже разобран, повтор ничего не меняет. Второй
  -- рубеж — unique (provider, provider_event_id) на случай гонки.
  if v_payment.status <> 'pending' then
    return query select false, v_payment.project_id, 0::bigint;
    return;
  end if;

  if not p_confirmed then
    update payment_transactions
       set status = 'failed',
           provider_event_id = coalesce(p_provider_event_id, provider_event_id)
     where id = p_payment_id;
    return query select false, v_payment.project_id, 0::bigint;
    return;
  end if;

  select p.id into v_leader_before
    from projects p
   where p.type = 'paid' and p.status = 'active' and p.rank1_since is not null
   limit 1;

  -- Блокировка по возрастанию id обязательна: во встречных операциях (Attack,
  -- срез 1.6) любой другой порядок даёт дедлок.
  perform 1 from projects
   where id in (v_payment.project_id, coalesce(v_leader_before, v_payment.project_id))
   order by id
   for update;

  begin
    update projects
       set paid_amount   = paid_amount + v_payment.points_granted,
           initial_stake = coalesce(initial_stake, v_payment.points_granted),
           status        = case when status = 'pending_payment' then 'active' else status end,
           updated_at    = now()
     where id = v_payment.project_id;
  exception
    -- Адрес не резервируется за строкой в pending_payment, поэтому слот мог
    -- занять кто-то другой, пока шла оплата. Очки не начисляем; для реального
    -- провайдера это случай возврата — срез 1.10.
    when unique_violation then
      update payment_transactions set status = 'failed' where id = p_payment_id;
      return query select false, v_payment.project_id, 0::bigint;
      return;
  end;

  insert into stake_transactions
    (transaction_group_id, payment_id, actor_user_id, project_id, amount, type)
  values
    (v_group, p_payment_id, v_payment.user_id, v_payment.project_id,
     v_payment.points_granted, 'raise');

  update payment_transactions
     set status = 'confirmed',
         confirmed_at = now(),
         provider_event_id = coalesce(p_provider_event_id, provider_event_id)
   where id = p_payment_id;

  -- rank1_since: лидер топа мог смениться. Лидер категории сюда не входит —
  -- его считает на лету вьюха category_stats.
  select p.id into v_leader_after
    from projects p
   where p.type = 'paid' and p.status = 'active'
   order by p.paid_amount desc, p.id asc
   limit 1;

  update projects set rank1_since = null
   where type = 'paid' and rank1_since is not null and id is distinct from v_leader_after;

  update projects set rank1_since = now()
   where id = v_leader_after and rank1_since is null;

  return query select true, v_payment.project_id, v_payment.points_granted;
end;
$$;

comment on function apply_payment is
  'Применяет платёж к счётчикам одной транзакцией. Идемпотентна: повторный вызов по тому же платежу — no-op';

revoke all on function apply_payment(uuid, text, boolean) from public, anon, authenticated;
grant execute on function apply_payment(uuid, text, boolean) to service_role;
```

- [ ] **Step 4: Применить миграцию и перегенерировать типы**

```bash
npm run db:push
npm run db:types
```

Ожидается: миграция применилась, `src/shared/api/database.types.ts` обновился.

- [ ] **Step 5: Запустить БД-тесты**

Run: `set -a && . ./.env && set +a && npm run test:db`
Expected: PASS, 5 тестов.

- [ ] **Step 6: Убедиться, что база чиста**

```bash
npx supabase db execute --linked "select count(*) from payment_transactions"
```

Ожидается: `0` — транзакции тестов откатились.

- [ ] **Step 7: Прогнать общий check**

Run: `npm run check`
Expected: зелёный (быстрые тесты БД не трогают).

- [ ] **Step 8: Коммит**

```bash
git add supabase/migrations supabase/tests package.json .env.example src/shared/api/database.types.ts
git commit -m "feat(db): add apply_payment transaction and pending_payment status"
```

---

## Task 3: Платёжный слой — типы, конвертация, мок

**Files:**

- Create: `supabase/functions/_shared/payments/types.ts`
- Create: `supabase/functions/_shared/payments/fx.ts`
- Create: `supabase/functions/_shared/payments/apply.ts`
- Create: `supabase/functions/_shared/payments/mock.ts`
- Create: `supabase/functions/_shared/payments/registry.ts`
- Test: `supabase/functions/_shared/payments/fx_test.ts`

**Interfaces:**

- Consumes: rpc `apply_payment` (задача 2), `getAdminClient()` из `_shared/db.ts`
- Produces:
  - `type PaymentIntent = 'raise' | 'attack'`
  - `interface FxRates { rubToUzs: number; usdToUzs: number }`
  - `function toPoints(amount: bigint, currency: string, rates: FxRates): { points: bigint; rate: string }`
  - `function fetchFxRates(): Promise<FxRates>`
  - `function applyPayment(paymentId: string, eventId: string, confirmed: boolean): Promise<ApplyResult>`
  - `interface PaymentProvider` с `id`, `mode`, `toPoints`, `createPayment`, `parseWebhook`
  - `function getProvider(): PaymentProvider`

- [ ] **Step 1: Написать тест конвертации**

Создать `supabase/functions/_shared/payments/fx_test.ts`:

```ts
import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { toPoints, type FxRates } from './fx.ts';

const rates: FxRates = { rubToUzs: 135, usdToUzs: 12100 };

Deno.test('UZS конвертируется один к одному — якорь 1 очко = 1 сум', () => {
  assertEquals(toPoints(50000n, 'UZS', rates), { points: 50000n, rate: '1' });
});

Deno.test('рубли переводятся по курсу из конфига', () => {
  assertEquals(toPoints(1000n, 'RUB', rates), { points: 135000n, rate: '135' });
});

Deno.test('доллары переводятся по курсу из конфига', () => {
  assertEquals(toPoints(2n, 'USD', rates), { points: 24200n, rate: '12100' });
});

Deno.test('неизвестная валюта — ошибка, а не молчаливый курс 1', () => {
  assertThrows(() => toPoints(100n, 'EUR', rates), Error, 'EUR');
});

Deno.test('нулевая и отрицательная сумма отвергаются', () => {
  assertThrows(() => toPoints(0n, 'UZS', rates), Error);
  assertThrows(() => toPoints(-1n, 'UZS', rates), Error);
});
```

- [ ] **Step 2: Запустить — тест обязан упасть**

Run: `npm run test`
Expected: FAIL — модуль `./fx.ts` не найден.

- [ ] **Step 3: Написать `types.ts`**

```ts
/**
 * Интерфейс платёжного провайдера из 04 Платежи и валюты. Бизнес-логика
 * Raise/Attack работает только с очками и paymentId — она не знает, что за
 * провайдер снаружи, и добавление настоящего не должно трогать её ни строкой.
 */

export type PaymentIntent = 'raise' | 'attack';

export type PaymentProviderId = 'mock' | 'globalpay' | 'platega' | 'paddle' | 'telegram_stars';

/** Как фронт открывает оплату: нативно внутри Telegram или редиректом. */
export type PaymentMode = 'telegram_native' | 'hosted';

export type PaymentStatus = 'confirmed' | 'pending' | 'failed';

export interface CreatePaymentInput {
  userId: string;
  intent: PaymentIntent;
  projectId: number;
  targetProjectId?: number;
  /** Сумма в валюте провайдера, целыми единицами. */
  amount: bigint;
}

export interface CreatePaymentResult {
  paymentId: string;
  status: PaymentStatus;
  /** Чем фронт откроет оплату. У мока нечего открывать — null. */
  openUrl: string | null;
  projectId: number;
  pointsGranted: number;
}

export interface WebhookEvent {
  /** Для идемпотентности. */
  eventId: string;
  paymentId: string;
  status: 'confirmed' | 'failed';
  originalAmount: bigint;
  originalCurrency: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly mode: PaymentMode;
  readonly currency: string;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(req: Request): Promise<WebhookEvent>;
}
```

- [ ] **Step 4: Написать `fx.ts`**

```ts
import { getAdminClient } from '../db.ts';

export interface FxRates {
  rubToUzs: number;
  usdToUzs: number;
}

/** Значения из init_schema — если строки конфига нет, курс выдумывать нельзя. */
const FALLBACK: FxRates = { rubToUzs: 135, usdToUzs: 12100 };

/**
 * Курсы фиксированные и лежат в app_config: топ не должен дёргаться от
 * колебаний рынка, а внешняя зависимость в платёжном пути — лишняя точка отказа
 * (04 Платежи и валюты).
 */
export async function fetchFxRates(): Promise<FxRates> {
  const { data, error } = await getAdminClient()
    .from('app_config')
    .select('value')
    .eq('key', 'fx_rates')
    .maybeSingle();

  if (error) throw error;
  const v = (data?.value ?? {}) as { rub_to_uzs?: number; usd_to_uzs?: number };
  return {
    rubToUzs: v.rub_to_uzs ?? FALLBACK.rubToUzs,
    usdToUzs: v.usd_to_uzs ?? FALLBACK.usdToUzs,
  };
}

/**
 * Якорь: 1 очко = 1 UZS, поэтому для основного рынка конвертация тождественна.
 * Возвращает и применённый курс — он пишется в payment_transactions.fx_rate_used
 * и больше никогда не пересчитывается.
 */
export function toPoints(
  amount: bigint,
  currency: string,
  rates: FxRates,
): { points: bigint; rate: string } {
  if (amount <= 0n) throw new Error(`Сумма должна быть положительной: ${amount}`);

  switch (currency) {
    case 'UZS':
      return { points: amount, rate: '1' };
    case 'RUB':
      return { points: amount * BigInt(rates.rubToUzs), rate: String(rates.rubToUzs) };
    case 'USD':
      return { points: amount * BigInt(rates.usdToUzs), rate: String(rates.usdToUzs) };
    default:
      throw new Error(`Неизвестная валюта: ${currency}`);
  }
}
```

- [ ] **Step 5: Запустить тесты конвертации**

Run: `npm run test`
Expected: PASS — 4 теста `telegram_test` и 5 тестов `fx_test`.

- [ ] **Step 6: Написать `apply.ts`**

```ts
import { getAdminClient } from '../db.ts';

export interface ApplyResult {
  applied: boolean;
  projectId: number;
  pointsGranted: number;
}

/**
 * Обёртка над хранимкой: сама транзакция живёт в базе (см. миграцию
 * payment_layer). Здесь только вызов и разбор ответа.
 */
export async function applyPayment(
  paymentId: string,
  eventId: string,
  confirmed: boolean,
): Promise<ApplyResult> {
  const { data, error } = await getAdminClient().rpc('apply_payment', {
    p_payment_id: paymentId,
    p_provider_event_id: eventId,
    p_confirmed: confirmed,
  });

  if (error) throw error;
  type Row = { applied: boolean; project_id: number; points_granted: number };
  const row = (data as Row[] | null)?.[0];
  if (!row) throw new Error('apply_payment ничего не вернул');

  return {
    applied: row.applied,
    projectId: row.project_id,
    pointsGranted: Number(row.points_granted),
  };
}
```

- [ ] **Step 7: Написать `mock.ts`**

```ts
import { applyPayment } from './apply.ts';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  WebhookEvent,
} from './types.ts';

/** Сценарии для тестов; в интерфейсе мини-аппа не используются. */
export type MockCommand = 'decline' | 'stuck_pending' | 'duplicate';

/**
 * Мок — не заглушка на время ожидания, а постоянная часть архитектуры: на нём
 * живут тесты и dev-окружение, гонять реальные платежи в CI никто не будет
 * (08 План разработки).
 *
 * Ссылки на оплату он не отдаёт: openInvoice требует настоящий provider_token,
 * которого до среза 1.10 нет. Эффект применяется прямо здесь, синхронно, и
 * фронт отличает случай по полю status, а не по имени провайдера.
 */
export function createMockProvider(command?: MockCommand): PaymentProvider {
  return {
    id: 'mock',
    mode: 'telegram_native',
    currency: 'UZS',

    async createPayment(
      input: CreatePaymentInput & { paymentId: string },
    ): Promise<CreatePaymentResult> {
      const eventId = `mock-${input.paymentId}`;

      if (command === 'stuck_pending') {
        return {
          paymentId: input.paymentId,
          status: 'pending',
          openUrl: null,
          projectId: input.projectId,
          pointsGranted: 0,
        };
      }

      const confirmed = command !== 'decline';
      const first = await applyPayment(input.paymentId, eventId, confirmed);
      // Повторный вебхук: второй вызов обязан оказаться no-op.
      if (command === 'duplicate') await applyPayment(input.paymentId, eventId, confirmed);

      return {
        paymentId: input.paymentId,
        status: confirmed ? 'confirmed' : 'failed',
        openUrl: null,
        projectId: first.projectId,
        pointsGranted: first.pointsGranted,
      };
    },

    parseWebhook(): Promise<WebhookEvent> {
      // У мока нет внешней стороны: подтверждение приходит синхронно выше.
      return Promise.reject(new Error('MockPaymentProvider не принимает вебхуков'));
    },
  };
}
```

Тип `createPayment` в интерфейсе принимает `CreatePaymentInput`; мок расширяет
его полем `paymentId`, потому что строку платежа создаёт вызывающая функция.
Отразить это в `types.ts`, поменяв сигнатуру на
`createPayment(input: CreatePaymentInput & { paymentId: string }): Promise<CreatePaymentResult>`.

- [ ] **Step 8: Написать `registry.ts`**

```ts
import { createMockProvider, type MockCommand } from './mock.ts';
import type { PaymentProvider } from './types.ts';

/**
 * Выбор провайдера конфигом, а не кодом: в этом весь смысл абстракции
 * (04 Платежи и валюты). Неизвестное значение — ошибка, а не молчаливый мок:
 * молчаливый мок в проде раздавал бы позиции бесплатно.
 */
export function getProvider(command?: MockCommand): PaymentProvider {
  const id = Deno.env.get('PAYMENT_PROVIDER') ?? 'mock';
  if (id === 'mock') return createMockProvider(command);
  throw new Error(`PAYMENT_PROVIDER=${id} не реализован (срез 1.10)`);
}

/** Команды мока принимаются только когда активен сам мок. */
export function mockCommandsAllowed(): boolean {
  return (Deno.env.get('PAYMENT_PROVIDER') ?? 'mock') === 'mock';
}
```

- [ ] **Step 9: Прогнать check**

Run: `npm run check`
Expected: зелёный.

- [ ] **Step 10: Коммит**

```bash
git add supabase/functions/_shared/payments
git commit -m "feat(payments): add provider interface, fx conversion and mock provider"
```

---

## Task 4: Edge Function `create-payment`

**Files:**

- Create: `supabase/functions/create-payment/index.ts`
- Create: `supabase/functions/create-payment/validate.ts`
- Test: `supabase/functions/create-payment/validate_test.ts`
- Modify: `.env.example` (`PAYMENT_PROVIDER`)

**Interfaces:**

- Consumes: `verifyInitData`, `resolveTelegramUser`, `fetchOg`, `getAdminClient`,
  `serve`/`badRequest`/`unauthorized` из `_shared/http.ts`, `getProvider`,
  `fetchFxRates`, `toPoints`
- Produces: `POST /create-payment` с телом
  `{ initData, amount, projectId? , categoryId?, url?, mockCommand? }` и ответом
  `CreatePaymentResult`

- [ ] **Step 1: Написать тест правил валидации**

Создать `supabase/functions/create-payment/validate_test.ts`:

```ts
import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { parseRequest } from './validate.ts';

const base = { initData: 'x', amount: 50000 };

Deno.test('довзнос: достаточно projectId', () => {
  const parsed = parseRequest({ ...base, projectId: 7 });
  assertEquals(parsed.kind, 'topup');
  assertEquals(parsed.amount, 50000n);
});

Deno.test('открывающий вход: нужны категория и ссылка', () => {
  const parsed = parseRequest({ ...base, categoryId: 1, url: 'https://example.com' });
  assertEquals(parsed.kind, 'opening');
});

Deno.test('без projectId и без пары категория+ссылка — отказ', () => {
  assertThrows(() => parseRequest(base), Error, 'projectId');
});

Deno.test('нецелая или отрицательная сумма отвергается', () => {
  assertThrows(() => parseRequest({ ...base, amount: 1.5, projectId: 7 }), Error);
  assertThrows(() => parseRequest({ ...base, amount: -1, projectId: 7 }), Error);
});

Deno.test('ссылка не http(s) отвергается', () => {
  assertThrows(
    () => parseRequest({ ...base, categoryId: 1, url: 'javascript:alert(1)' }),
    Error,
    'http',
  );
});

Deno.test('минимум ставки берётся с сервера, а не из запроса', () => {
  assertThrows(() => parseRequest({ ...base, amount: 100, projectId: 7 }, 50000), Error, 'Минимум');
});
```

- [ ] **Step 2: Запустить — тест обязан упасть**

Run: `npm run test`
Expected: FAIL — модуль `./validate.ts` не найден.

- [ ] **Step 3: Написать `validate.ts`**

```ts
import { badRequest } from '../_shared/http.ts';

export interface CreatePaymentBody {
  initData?: string;
  amount?: number;
  projectId?: number;
  categoryId?: number;
  url?: string;
  mockCommand?: string;
}

export type ParsedRequest =
  | { kind: 'topup'; initData: string; amount: bigint; projectId: number }
  | { kind: 'opening'; initData: string; amount: bigint; categoryId: number; url: string };

const MAX_URL_LENGTH = 2048;

/**
 * Чистые правила запроса — без сети и без базы, поэтому тестируются отдельно.
 * Минимум ставки приходит вторым аргументом из app_config: в клиенте его нет,
 * и расхождение здесь стоило бы денег.
 */
export function parseRequest(body: CreatePaymentBody, minPaidAmount?: number): ParsedRequest {
  if (!body.initData) throw badRequest('initData обязателен');

  const amount = body.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw badRequest('Сумма должна быть целым положительным числом');
  }
  if (minPaidAmount !== undefined && amount < minPaidAmount) {
    throw badRequest(`Минимум ставки — ${minPaidAmount}`);
  }

  if (Number.isInteger(body.projectId)) {
    return {
      kind: 'topup',
      initData: body.initData,
      amount: BigInt(amount),
      projectId: body.projectId!,
    };
  }

  if (!Number.isInteger(body.categoryId) || !body.url) {
    throw badRequest('Нужен либо projectId, либо пара categoryId + url');
  }
  if (body.url.length > MAX_URL_LENGTH) throw badRequest('Ссылка слишком длинная');

  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    throw badRequest('Ссылка не распознана');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw badRequest('Ссылка должна быть http(s)');
  }

  return {
    kind: 'opening',
    initData: body.initData,
    amount: BigInt(amount),
    categoryId: body.categoryId!,
    url: parsed.toString(),
  };
}
```

- [ ] **Step 4: Запустить тесты валидации**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Написать `index.ts`**

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest, unauthorized, notFound } from '../_shared/http.ts';
import { verifyInitData } from '../_shared/telegram.ts';
import { resolveTelegramUser } from '../_shared/identity.ts';
import { getAdminClient } from '../_shared/db.ts';
import { fetchOg } from '../_shared/og.ts';
import { fetchFxRates, toPoints } from '../_shared/payments/fx.ts';
import { getProvider, mockCommandsAllowed } from '../_shared/payments/registry.ts';
import type { MockCommand } from '../_shared/payments/mock.ts';
import { parseRequest, type CreatePaymentBody } from './validate.ts';

/**
 * Единственная точка, где начинается платёж. Валидация трижды, а не дважды
 * (04 Платежи и валюты): здесь, в pre_checkout_query у реального провайдера и в
 * транзакции применения. Эта — первая.
 */
serve('create-payment', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const body = await ctx.body<CreatePaymentBody>();
  const db = getAdminClient();

  const { data: limits, error: limitsError } = await db
    .from('app_config')
    .select('value')
    .eq('key', 'paid_limits')
    .single();
  if (limitsError) throw limitsError;
  const minPaidAmount = (limits.value as { min_paid_amount?: number }).min_paid_amount ?? 50000;

  const parsed = parseRequest(body, minPaidAmount);

  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN не задан в окружении функции');
  const verified = await verifyInitData(parsed.initData, botToken);
  if (!verified) throw unauthorized('initData не прошёл проверку');

  const { userId } = await resolveTelegramUser(verified.user, verified.startParam);

  let projectId: number;

  if (parsed.kind === 'topup') {
    const { data: project, error } = await db
      .from('projects')
      .select('id, user_id, type, status')
      .eq('id', parsed.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!project) throw notFound('Проект не найден');
    if (project.user_id !== userId) throw badRequest('Это не твой проект');
    if (project.type !== 'paid') throw badRequest('Ставка есть только у платных проектов');
    if (project.status !== 'active') throw badRequest('Проект неактивен');
    projectId = project.id;
  } else {
    const { data: taken, error: takenError } = await db
      .from('projects')
      .select('id')
      .eq('type', 'paid')
      .eq('status', 'active')
      .or(`user_id.eq.${userId},url.eq.${parsed.url}`)
      .maybeSingle();
    if (takenError) throw takenError;
    if (taken) throw badRequest('Слот платного топа или этот адрес уже заняты');

    const og = await fetchOg(parsed.url);
    ctx.log('og fetched', { status: og.status });

    // Брошенные оплаты не копятся: у пользователя не больше одной строки
    // pending_payment на топ. Удалять нельзя — на неё ссылается платёж.
    const { data: abandoned } = await db
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'paid')
      .eq('status', 'pending_payment')
      .maybeSingle();

    const fields = {
      user_id: userId,
      category_id: parsed.categoryId,
      type: 'paid' as const,
      status: 'pending_payment' as const,
      name: og.name,
      url: parsed.url,
      og_description: og.description,
      og_image_url: og.imageUrl,
      og_status: og.status,
      og_fetched_at: new Date().toISOString(),
    };

    const { data: row, error: writeError } = abandoned
      ? await db.from('projects').update(fields).eq('id', abandoned.id).select('id').single()
      : await db.from('projects').insert(fields).select('id').single();
    if (writeError) throw writeError;
    projectId = row.id;
  }

  const rates = await fetchFxRates();
  const provider = getProvider(
    mockCommandsAllowed() ? (body.mockCommand as MockCommand | undefined) : undefined,
  );
  const { points, rate } = toPoints(parsed.amount, provider.currency, rates);

  const { data: payment, error: paymentError } = await db
    .from('payment_transactions')
    .insert({
      user_id: userId,
      project_id: projectId,
      intent: 'raise',
      provider: provider.id,
      original_currency: provider.currency,
      original_amount: Number(parsed.amount),
      fx_rate_used: rate,
      points_granted: Number(points),
      status: 'pending',
    })
    .select('id')
    .single();
  if (paymentError) throw paymentError;

  const result = await provider.createPayment({
    paymentId: payment.id,
    userId,
    intent: 'raise',
    projectId,
    amount: parsed.amount,
  });

  ctx.log('payment created', { paymentId: payment.id, status: result.status, projectId });
  return result;
});
```

- [ ] **Step 6: Записать переменную окружения**

В `.env.example`:

```
# Активный платёжный провайдер Edge Functions: mock до среза 1.10
# PAYMENT_PROVIDER=mock
```

- [ ] **Step 7: Задеплоить и проверить живьём**

Деплой — MCP-инструментом `deploy_edge_function` с `verify_jwt: true` (функцию
зовёт клиент с anon-ключом, как `add-project`). В `files` передать и сам
`create-payment/index.ts`, и `validate.ts`, и все `_shared/*`, на которые он
ссылается. Через CLI это было бы `npx supabase functions deploy create-payment`,
но он здесь не залогинен.

Проверка отказа без валидного `initData` (подделать его нельзя, и это главное,
что здесь надо увидеть):

```bash
curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/create-payment" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H 'content-type: application/json' \
  -d '{"initData":"broken","amount":50000,"projectId":1}' | jq
```

Ожидается: `401` и `{"error":{"code":"unauthorized", ...}}`.

- [ ] **Step 8: Прогнать check и закоммитить**

```bash
npm run check
git add supabase/functions/create-payment .env.example
git commit -m "feat(payments): add create-payment edge function"
```

---

## Task 5: Edge Function `payment-webhook`

Её в срезе 1.5 не зовёт никто, кроме тестов. Она пишется сейчас, чтобы срез 1.10
не начинал с написания второго места, где двигаются деньги.

**Files:**

- Create: `supabase/functions/payment-webhook/index.ts`
- Test: `supabase/functions/payment-webhook/index_test.ts`

**Interfaces:**

- Consumes: `getProvider`, `applyPayment`, `serve`
- Produces: `POST /payment-webhook` → `{ applied: boolean }`

- [ ] **Step 1: Написать тест**

Создать `supabase/functions/payment-webhook/index_test.ts`:

```ts
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { createMockProvider } from '../_shared/payments/mock.ts';

Deno.test('мок не принимает вебхуков — подтверждение приходит синхронно', async () => {
  const provider = createMockProvider();
  await assertRejects(
    () => provider.parseWebhook(new Request('https://example.com', { method: 'POST' })),
    Error,
    'не принимает вебхуков',
  );
});

Deno.test('неизвестный PAYMENT_PROVIDER не подменяется моком молча', async () => {
  const previous = Deno.env.get('PAYMENT_PROVIDER');
  Deno.env.set('PAYMENT_PROVIDER', 'globalpay');
  try {
    const { getProvider } = await import('../_shared/payments/registry.ts');
    let failed = false;
    try {
      getProvider();
    } catch {
      failed = true;
    }
    assertEquals(failed, true);
  } finally {
    if (previous === undefined) Deno.env.delete('PAYMENT_PROVIDER');
    else Deno.env.set('PAYMENT_PROVIDER', previous);
  }
});
```

- [ ] **Step 2: Запустить**

Run: `npm run test --  --allow-env`

Точнее — обновить скрипт, потому что тест читает и пишет переменные окружения:

```json
"test": "deno test --allow-env supabase/functions"
```

Expected: PASS.

- [ ] **Step 3: Написать `index.ts`**

```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve, badRequest } from '../_shared/http.ts';
import { getProvider } from '../_shared/payments/registry.ts';
import { applyPayment } from '../_shared/payments/apply.ts';

/**
 * Точка входа вебхуков провайдера. В срезе 1.5 её не зовёт никто: мок
 * подтверждает платёж синхронно внутри create-payment. Она существует, чтобы
 * применение эффекта было ровно в одном месте, когда в срезе 1.10 придёт
 * настоящий провайдер.
 *
 * Подпись проверяется внутри parseWebhook — до любой обработки тела.
 */
serve('payment-webhook', async (req, ctx) => {
  if (req.method !== 'POST') throw badRequest('Ожидается POST');

  const event = await getProvider().parseWebhook(req);
  const result = await applyPayment(event.paymentId, event.eventId, event.status === 'confirmed');

  ctx.log('webhook applied', {
    paymentId: event.paymentId,
    eventId: event.eventId,
    applied: result.applied,
  });

  return { applied: result.applied };
});
```

- [ ] **Step 4: Задеплоить**

Деплой — MCP-инструментом `deploy_edge_function`, но с **`verify_jwt: false`**:
провайдер шлёт вебхук без JWT, ровно как Telegram в функцию `bot`. Подпись
проверяет сам `parseWebhook`, до разбора тела.

- [ ] **Step 5: Прогнать check и закоммитить**

```bash
npm run check
git add supabase/functions/payment-webhook package.json
git commit -m "feat(payments): add payment-webhook entry point for real providers"
```

---

## Task 6: Клиент — фича `raise` и мок в списке способов оплаты

**Files:**

- Create: `src/features/raise/types.ts`
- Create: `src/features/raise/api.ts`
- Create: `src/features/raise/index.ts`
- Modify: `src/shared/config/preview.ts`
- Modify: `src/shared/content/payments.ts`
- Modify: `src/widgets/mobile/PaySheet.tsx`
- Modify: `src/shared/i18n/strings.ts`

**Interfaces:**

- Consumes: `POST /create-payment` (задача 4), `getSupabase`, `functionErrorMessage`
- Produces:
  - `interface CreatePaymentParams { initData: string; amount: number; projectId?: number; categoryId?: number; url?: string }`
  - `interface PaymentResult { paymentId: string; status: 'confirmed' | 'pending' | 'failed'; openUrl: string | null; projectId: number; pointsGranted: number }`
  - `function createRaisePayment(params: CreatePaymentParams): Promise<PaymentResult>`
  - `activePaymentMethods: readonly [PaymentProvider, ...PaymentProvider[]]`

- [ ] **Step 1: Добавить флаг**

В `src/shared/config/preview.ts`, в объект `PREVIEW`:

```ts
  /**
   * Платежи идут через мок: подтверждение мгновенное и бесплатное.
   * Нужно: настоящий провайдер (Срез 1.10). До тех пор платное #1 можно занять
   * даром — терпимо, пока в топе только сидовые проекты.
   *
   * ЭТОТ ФЛАГ ОБЯЗАН БЫТЬ СНЯТ ДО БОЕВОГО ЗАПУСКА. Единственный флаг в файле,
   * который стоит денег, а не рисует заглушку.
   */
  mockPayments: true,
```

- [ ] **Step 2: Завести типы фичи**

Создать `src/features/raise/types.ts`:

```ts
export interface CreatePaymentParams {
  initData: string;
  /** Сумма в очках: для UZS это и есть сумы (04 Платежи и валюты). */
  amount: number;
  /** Довзнос к своей ставке. Взаимоисключим с парой categoryId + url. */
  projectId?: number;
  /** Открывающий вход: категория и ссылка нового проекта. */
  categoryId?: number;
  url?: string;
}

export interface PaymentResult {
  paymentId: string;
  status: 'confirmed' | 'pending' | 'failed';
  /** Чем открыть оплату у hosted-провайдера. У мока нечего открывать. */
  openUrl: string | null;
  projectId: number;
  pointsGranted: number;
}
```

- [ ] **Step 3: Написать вызов**

Создать `src/features/raise/api.ts`:

```ts
import { getSupabase, functionErrorMessage } from '@/shared/api';
import type { CreatePaymentParams, PaymentResult } from './types';

/**
 * Начать платёж за позицию. Правила — минимум ставки, принадлежность проекта,
 * занятость слота — проверяет сервер: клиент их не дублирует, расхождение
 * здесь стоило бы денег.
 */
export async function createRaisePayment(params: CreatePaymentParams): Promise<PaymentResult> {
  const { data, error } = await getSupabase().functions.invoke<PaymentResult>('create-payment', {
    method: 'POST',
    body: params,
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Не удалось начать оплату'));
  if (!data) throw new Error('create-payment ответил пусто');
  return data;
}
```

Создать `src/features/raise/index.ts`:

```ts
export { createRaisePayment } from './api';
export type { CreatePaymentParams, PaymentResult } from './types';
```

- [ ] **Step 4: Добавить честный мок-способ оплаты**

В `src/shared/content/payments.ts`, ниже существующего `payments`:

```ts
// Пока платежи идут через мок, показывать GlobalPay и Platega нельзя: имя
// настоящего провайдера под мгновенным бесплатным подтверждением — прямая
// неправда. Мок называет себя моком.
const mockMethod: PaymentProvider = {
  id: 'mock',
  name: 'Test payment',
  icon: 'credit-card',
  desc: 'Confirms instantly — no money moves',
  unit: 'UZS',
};

/** Способы оплаты, доступные прямо сейчас. Список меняется в Срезе 1.10. */
export const activePaymentMethods: readonly [PaymentProvider, ...PaymentProvider[]] =
  PREVIEW.mockPayments ? [mockMethod] : payments;
```

и импорт в начале файла:

```ts
import { PREVIEW } from '@/shared/config/preview';
```

- [ ] **Step 5: Переключить PaySheet на этот список**

В `src/widgets/mobile/PaySheet.tsx` заменить импорт и все три обращения к
`payments` на `activePaymentMethods`:

```ts
import { activePaymentMethods } from '@/shared/content';
```

Заменить `payments[0].id` → `activePaymentMethods[0].id` (две штуки),
`payments.find(...) ?? payments[0]` → `activePaymentMethods.find(...) ?? activePaymentMethods[0]`,
`payments.map(...)` → `activePaymentMethods.map(...)`.

Проверить, что `activePaymentMethods` реэкспортирован из
`src/shared/content/index.ts` рядом с `payments`.

- [ ] **Step 6: Добавить строки результата**

В `src/shared/i18n/strings.ts`, в объект `raise`:

```ts
    resultTitle: 'Bid raised',
    resultNote: (amount: string, unit: string) =>
      `${amount} ${unit} applied. The position updates for everyone right away.`,
    openingResultTitle: 'You are in the Paid Top',
    failed: 'The payment did not go through — nothing was charged.',
```

- [ ] **Step 7: Прогнать check**

Run: `npm run check`
Expected: зелёный. Если `no-restricted-imports` ругается — проверить, что
`features/raise` не импортирует ничего из `widgets/` и `app/`.

- [ ] **Step 8: Коммит**

```bash
git add src/features/raise src/shared/config/preview.ts src/shared/content src/widgets/mobile/PaySheet.tsx src/shared/i18n/strings.ts
git commit -m "feat(raise): add create-payment client and label the mock honestly"
```

---

## Task 7: Клиент — подключение Raise и платного входа

**Files:**

- Modify: `src/pages/paid/ui/Mobile.tsx`
- Modify: `src/widgets/mobile/ShowcaseScreen.tsx`
- Modify: `src/widgets/mobile/AddProjectSheet.tsx`
- Modify: `src/shared/i18n/strings.ts` (снять `paidSoon`)

**Interfaces:**

- Consumes: `createRaisePayment`, `RaiseSheet`, `PaySheet`, `ResultSheet`,
  `AddProjectSheet`, хуки `usePaidOwnPosition`/`usePaidShowcase` из `pages/paid/model`
- Produces: рабочий путь «кнопка → шторка → оплата → новая позиция» на вкладке Paid

- [ ] **Step 1: Разблокировать Paid в ShowcaseScreen**

В `src/widgets/mobile/ShowcaseScreen.tsx` заменить жёстко выключенное действие на
приходящее пропом. В `ShowcaseScreenProps` добавить:

```ts
  /** Raise своей ставки — приходит с Paid Top начиная со Среза 1.5. */
  onAction?: () => void;
```

В деструктуризации добавить `onAction`, и в `OwnPositionPanel` заменить:

```tsx
                actionDisabled={!onAction}
                onAction={onAction}
```

(вместо текущего `actionDisabled` без значения). Комментарий выше поправить:
Raise подключён, Vote ждёт среза 1.7.

- [ ] **Step 2: Разблокировать Paid в AddProjectSheet**

В `src/widgets/mobile/AddProjectSheet.tsx` убрать жёсткую блокировку:

```tsx
const locked = d.id === 'paid';
```

заменить на приходящий проп `paidLocked` со значением по умолчанию `false`:

```tsx
const locked = d.id === 'paid' && paidLocked;
```

Добавить в `AddProjectSheetProps`:

```ts
  /** Платный вход открывается вместе с платёжным слоем; до него — карточка видна, но неактивна. */
  paidLocked?: boolean;
```

и в деструктуризацию `paidLocked = false`.

Добавить поле ввода открывающей ставки, когда выбран Paid — под блоком
«где соревнуется», используя уже существующие строки `t.openingBidLabel` и
`t.openingBidError`:

```tsx
{
  paid && (
    <AmountInput
      segment="paid"
      value={bid}
      onChange={setBid}
      currency="UZS"
      step={minPaidAmount}
      min={minPaidAmount}
      presets={[minPaidAmount, minPaidAmount * 2, minPaidAmount * 10]}
      label={t.openingBidLabel}
      error={bid < minPaidAmount ? t.openingBidError(String(minPaidAmount)) : undefined}
    />
  );
}
```

со состоянием `const [bid, setBid] = useState(minPaidAmount)` и новым обязательным
пропом `minPaidAmount: number`. Сброс `bid` при открытии — в том же блоке
сравнения `open !== prevOpen`, где сбрасываются остальные поля (не в эффекте:
`react-hooks/set-state-in-effect`).

Сигнатуру `onSubmit` расширить: `(params: { url, categoryId, segment, bid: number }) => Promise<void>`.

- [ ] **Step 3: Собрать путь на странице Paid**

Переписать `src/pages/paid/ui/Mobile.tsx`:

```tsx
import { useState } from 'react';
import type { Navigation } from '@/app/navigation';
import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { registerClick, type ProjectListItem } from '@/entities/project';
import { createRaisePayment, type PaymentResult } from '@/features/raise';
import { formatMoney } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import { AddProjectSheet } from '@/widgets/mobile/AddProjectSheet';
import { RaiseSheet } from '@/widgets/mobile/RaiseSheet';
import { PaySheet, type PayPayload } from '@/widgets/mobile/PaySheet';
import { ResultSheet, type ActionResult } from '@/widgets/mobile/ResultSheet';
import {
  usePaidCategories,
  usePaidOwnPosition,
  usePaidShowcase,
  usePaidTopProject,
  useMinPaidAmount,
} from '../model';

export interface PaidMobileProps {
  nav: Navigation;
}

/** Что оплачиваем: довзнос к своей ставке или открывающий вход новым проектом. */
type Pending =
  | { kind: 'raise'; amount: number; project: ProjectListItem }
  | { kind: 'opening'; amount: number; url: string; categoryId: number };

export function PaidMobile({ nav }: PaidMobileProps) {
  const { userId, status: sessionStatus, errorMessage: sessionErrorMessage } = useSession();
  const showcase = usePaidShowcase();
  const categories = usePaidCategories();
  const own = usePaidOwnPosition(showcase.categoryId, userId);
  const topProject = usePaidTopProject();
  const minStep = useMinPaidAmount();

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const refresh = () => {
    showcase.retry();
    categories.retry();
    topProject.retry();
    own.retry();
  };

  const pay = async () => {
    if (!pending) return;
    const initData = getPlatform().getInitData();
    if (!initData) {
      setPayError(strings.raise.failed);
      return;
    }

    setPayError(null);
    let outcome: PaymentResult;
    try {
      outcome = await createRaisePayment({
        initData,
        amount: pending.amount,
        ...(pending.kind === 'raise'
          ? { projectId: pending.project.id }
          : { categoryId: pending.categoryId, url: pending.url }),
      });
    } catch (error) {
      setPayError(error instanceof Error ? error.message : strings.raise.failed);
      return;
    }

    setPending(null);
    if (outcome.status !== 'confirmed') {
      setPayError(strings.raise.failed);
      return;
    }

    // Позицию считает витрина после перечитывания; до тех пор показываем ту,
    // что была, — цифра в квитанции справочная.
    refresh();
    setResult({
      kind: 'raise',
      title:
        pending.kind === 'raise' ? strings.raise.resultTitle : strings.raise.openingResultTitle,
      rank: own.rank ?? 1,
      note: strings.raise.resultNote(formatMoney(pending.amount, { compact: false }), "so'm"),
    });
  };

  return (
    <>
      <ShowcaseScreen
        segment="paid"
        minStep={minStep}
        categories={categories.categories}
        topProjectName={topProject.name}
        categoryId={showcase.categoryId}
        onCategoryChange={showcase.setCategoryId}
        ownProject={own.project}
        ownRank={own.rank}
        ownNeighborAbove={own.neighborAbove}
        ownLoading={own.loading}
        voteBalance={null}
        userId={userId}
        sessionStatus={sessionStatus}
        sessionErrorMessage={sessionErrorMessage}
        items={showcase.items}
        loading={showcase.loading}
        loadingMore={showcase.loadingMore}
        hasMore={showcase.hasMore}
        error={showcase.error}
        onLoadMore={showcase.loadMore}
        onRetry={showcase.retry}
        onOpenRules={() => nav.push({ name: 'rules', anchor: 'bidding' })}
        onOpenProject={(item) => {
          const initData = getPlatform().getInitData();
          if (initData) registerClick({ initData, projectId: item.id }).catch(() => {});
          getPlatform().openLink(item.url);
        }}
        onAction={own.project ? () => setRaiseOpen(true) : undefined}
        onAddProject={userId && !own.project ? () => setAddOpen(true) : undefined}
      />

      <RaiseSheet
        open={raiseOpen}
        project={own.project}
        rank={own.rank}
        minAmount={minStep}
        onClose={() => setRaiseOpen(false)}
        onConfirm={(amount) => {
          if (!own.project) return;
          setRaiseOpen(false);
          setPending({ kind: 'raise', amount, project: own.project });
        }}
      />

      <AddProjectSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories.categories}
        taken={{ paid: Boolean(own.project) }}
        minPaidAmount={minStep}
        onSubmit={async ({ url, categoryId, bid }) => {
          setAddOpen(false);
          setPending({ kind: 'opening', amount: bid, url, categoryId });
        }}
      />

      <PaySheet
        open={pending !== null}
        payload={
          pending
            ? ({
                kind: pending.kind === 'raise' ? 'raise' : 'project',
                amount: pending.amount,
                subtitle: pending.kind === 'raise' ? pending.project.name : pending.url,
              } satisfies PayPayload)
            : null
        }
        onClose={() => setPending(null)}
        onConfirm={pay}
      />

      <ResultSheet open={result !== null} result={result} onClose={() => setResult(null)} />

      {payError && <p role="alert">{payError}</p>}
    </>
  );
}
```

- [ ] **Step 4: Убрать устаревшую строку**

В `src/shared/i18n/strings.ts` удалить `paidSoon` и комментарий над ней — платный
вход открыт. Проверить, что она больше нигде не используется:

Run: `grep -rn "paidSoon" src/`
Expected: пусто.

- [ ] **Step 5: Прогнать check**

Run: `npm run check`
Expected: зелёный.

- [ ] **Step 6: Проверить в браузере**

```bash
npm run dev
```

В вебе `initData` пустой, поэтому платёж не пройдёт — это ожидаемо. Проверить, что
шторки открываются в правильном порядке и Cancel закрывает каждую:
Paid Top → «Add my project» → выбор категории и ставки → PaySheet со способом
«Test payment» → отказ с внятным текстом.

- [ ] **Step 7: Проверить в Telegram**

Смёржить ветку, дождаться деплоя, открыть `app.bidwar.world` в Telegram и
провести полный путь: добавить проект в Paid Top с открывающей ставкой, увидеть
его в витрине, поднять ставку через Raise, увидеть новую позицию.

Сверить леджер:

```bash
npx supabase db execute --linked "
select p.id, p.paid_amount, coalesce(sum(s.amount), 0) as ledger
from projects p left join stake_transactions s on s.project_id = p.id
where p.type = 'paid' group by p.id, p.paid_amount
having p.paid_amount <> coalesce(sum(s.amount), 0)"
```

Ожидается: пусто — очки проекта равны сумме его stake-транзакций.

- [ ] **Step 8: Коммит**

```bash
git add src/pages/paid/ui/Mobile.tsx src/widgets/mobile/ShowcaseScreen.tsx src/widgets/mobile/AddProjectSheet.tsx src/shared/i18n/strings.ts
git commit -m "feat(raise): wire paid entry and raise through the payment sheets"
```

---

## Task 8: Документы

Расхождение документа с кодом, оставленное на потом, обходится дороже правки
(CLAUDE.md).

**Files:**

- Modify: `~/Documents/Obsidian Storage/Проекты/BidWar/02 Архитектура.md`
- Modify: `~/Documents/Obsidian Storage/Проекты/BidWar/12 Состояние реализации.md`
- Modify: `~/Documents/Obsidian Storage/Проекты/BidWar/08 План разработки.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Поправить схему компонентов в `02 Архитектура`**

В блоке со списком Edge Functions заменить строки

```text
              │ payments    ○ PaymentProvider      (1.5)
              │ actions     ○ raise / attack / vote (1.5–1.7)
```

на фактические имена:

```text
              │ create-payment  ✅ валидация и создание платежа
              │ payment-webhook ✅ вебхуки провайдеров (ждёт 1.10)
              │ actions         ○ attack / vote      (1.6–1.7)
```

- [ ] **Step 2: Обновить `12 Состояние реализации`**

- В «Одной строкой» убрать «Денег в продукте нет ни одной строкой», заменив на
  описание фактического состояния: Raise и платный вход работают на моке.
- В таблицу «Что работает по-настоящему» добавить строки про платёжный слой,
  `apply_payment` и Raise.
- Из «Что свёрстано, но не подключено» убрать `RaiseSheet`, `PaySheet`,
  `ResultSheet` — остаются `AttackSheet` и `VoteSheet`.
- В «Долги и пробелы» заменить блок «Автотестов нет ни одного» на описание двух
  уровней: `npm run test` (быстрые, в CI) и `npm run test:db` (требуют
  `SUPABASE_DB_URL`, гоняются руками перед пушем миграции).
- Добавить в долги: **флаг `mockPayments` обязан быть снят до боевого запуска.**

- [ ] **Step 3: Отметить срез в `08 План разработки`**

Пометить `1.5` как закрытый, описать что сделано, следующим назвать `1.6 Attack`.
В разделе «Тестирование» заменить предупреждение об отсутствии раннера на
описание двух уровней.

- [ ] **Step 4: Обновить `CLAUDE.md`**

- В разделе «Состояние»: закрыт срез 1.5, следующий — 1.6 Attack. Убрать
  «Денег в продукте нет ни одной строкой» и «Автотестов нет ни одного, раннера
  тоже».
- В «Перед пушем» добавить, что `check` включает `npm run test`, а БД-тесты
  гоняются отдельно командой `npm run test:db` и требуют `SUPABASE_DB_URL`.

- [ ] **Step 5: Обновить README**

Добавить `npm run test` и `npm run test:db` в таблицу команд с пометкой, что
второй требует Deno и `SUPABASE_DB_URL`.

- [ ] **Step 6: Коммит и PR**

```bash
git add CLAUDE.md README.md
git commit -m "docs: record slice 1.5 as done and describe the two test tiers"
gh pr create
```

Документы в Obsidian лежат вне репозитория и коммита не требуют.

---

## Самопроверка плана

**Покрытие спека.** Каждый раздел спека закрыт задачей: границы среза → задачи
1–8; пять решений → задачи 1 (раннер), 2 (`pending_payment`), 3 (мок и реестр),
4 (имена функций), 6 (флаг); данные и брошенные оплаты → задачи 2 и 4; гонка за
адрес → задача 2 (обработчик `unique_violation`) и задача 4 (ранняя проверка);
платёжный слой → задача 3; транзакция → задача 2; Edge Functions → задачи 4 и 5;
клиент → задачи 6 и 7; тесты → распределены по задачам, где пишется сам код;
риски → задача 6 (флаг), задача 2 (гонка), задача 8 (запись долга).

**Тесты из спека и где они стоят:** идемпотентность, `initial_stake`,
`rank1_since`, отказ провайдера — задача 2; конвертация — задача 3; минимум
ставки — задача 4; `initData` — задача 1. Хейркат и floor относятся к Attack и в
этот срез не входят, как и сказано в спеке.

**Согласованность имён.** `apply_payment` (SQL) ↔ `applyPayment` (TS) ↔ вызовы в
`mock.ts` и `payment-webhook`; `CreatePaymentResult` возвращается из
`provider.createPayment`, из `create-payment` и типизирован на клиенте как
`PaymentResult` с теми же полями; `activePaymentMethods` заводится в задаче 6 и
там же потребляется `PaySheet`; `minPaidAmount` — новый обязательный проп
`AddProjectSheet`, передаётся из `PaidMobile` в задаче 7.
