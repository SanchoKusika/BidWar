-- BidWar — начальная схема.
-- Источник: «03 Данные», транзакционная модель и RLS — «02 Архитектура».
--
-- Общие правила типов: деньги и очки — BIGINT в целых единицах, курсы —
-- NUMERIC(20,10), время — TIMESTAMPTZ (UTC). float не используется нигде.

-- ---------------------------------------------------------------------------
-- 1. Справочники
-- ---------------------------------------------------------------------------

create table categories (
  id          smallserial primary key,
  slug        text     not null unique,
  title       text     not null,
  sort_order  smallint not null,
  is_active   boolean  not null default true
);

-- ---------------------------------------------------------------------------
-- 2. Идентичность
-- ---------------------------------------------------------------------------

create table users (
  id               uuid        primary key default gen_random_uuid(),
  display_name     text        not null,
  avatar_url       text,
  referrer_id      uuid        references users (id),
  vote_balance     bigint      not null default 0 check (vote_balance >= 0),
  display_currency text        not null default 'UZS' check (display_currency in ('UZS', 'RUB', 'USD')),
  status           text        not null default 'active' check (status in ('active', 'blocked')),
  created_at       timestamptz not null default now(),

  constraint users_referrer_not_self check (referrer_id is null or referrer_id <> id)
);

comment on column users.vote_balance is 'Нераспределённые голоса пользователя';

create index users_referrer_idx on users (referrer_id) where referrer_id is not null;

-- «Кто человек» и «чем он вошёл» разнесены: email/Google добавляются в Этапе 2
-- без миграции таблиц, на которые уже ссылается денежный леджер.
create table auth_identities (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references users (id),
  provider     text        not null check (provider in ('telegram', 'email', 'google')),
  provider_uid text        not null,
  meta         jsonb,
  created_at   timestamptz not null default now(),

  unique (provider, provider_uid)
);

comment on column auth_identities.provider_uid is 'telegram_id | email | google sub';

create index auth_identities_user_idx on auth_identities (user_id);

-- ---------------------------------------------------------------------------
-- 3. Проекты
-- ---------------------------------------------------------------------------

create table projects (
  id              bigserial   primary key,
  user_id         uuid        not null references users (id),
  category_id     smallint    not null references categories (id),
  name            text        not null,
  url             text        not null,
  type            text        not null check (type in ('paid', 'free')),

  paid_amount     bigint      not null default 0 check (paid_amount >= 0),
  votes           bigint      not null default 0 check (votes >= 0),
  initial_stake   bigint      check (initial_stake is null or initial_stake > 0),
  clicks          bigint      not null default 0 check (clicks >= 0),
  rank1_since     timestamptz,

  og_image_url    text,
  og_description  text,
  og_status       text        not null default 'pending' check (og_status in ('pending', 'ok', 'failed')),
  og_fetched_at   timestamptz,

  tg_chat_id      bigint,
  tg_bot_is_admin boolean     not null default false,

  status          text        not null default 'active' check (status in ('active', 'hidden', 'blocked')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Счётчики взаимоисключающие: платный проект не набирает голоса, бесплатный — очки.
  constraint projects_counters_exclusive
    check ((type = 'paid' and votes = 0) or (type = 'free' and paid_amount = 0))
);

comment on column projects.id is 'Монотонный, используется как тай-брейк при равных значениях';
comment on column projects.initial_stake is 'Первая ставка проекта, база для floor. Денормализовано: floor проверяется в каждой атаке под FOR UPDATE, агрегат по леджеру там недопустим';
comment on column projects.clicks is 'Публичный счётчик переходов. Инвариант на будущее: инкремент в той же транзакции, что вставка в project_clicks — сам клик-эндпоинт появится позже, в этом срезе кода ещё нет';
comment on column projects.rank1_since is 'С какого момента проект держит #1 в своём топе, null — если не лидер';
comment on column projects.tg_chat_id is 'Заполнен, если проект — TG-канал и бот в нём администратор (нужно для subscribe-заданий)';

-- Общие витрины. Порядок ORDER BY paid_amount DESC, id ASC — тай-брейк обязателен,
-- иначе курсорная пагинация дублирует и пропускает строки.
create index projects_paid_top_idx
  on projects (paid_amount desc, id asc) where type = 'paid' and status = 'active';
create index projects_free_top_idx
  on projects (votes desc, id asc) where type = 'free' and status = 'active';

-- Витрины внутри категории
create index projects_paid_top_by_category_idx
  on projects (category_id, paid_amount desc, id asc) where type = 'paid' and status = 'active';
create index projects_free_top_by_category_idx
  on projects (category_id, votes desc, id asc) where type = 'free' and status = 'active';

-- По одной активной записи в каждом топе на пользователя: одна платная и одна
-- бесплатная, в том числе на один и тот же адрес.
create unique index projects_one_active_per_user_and_type_idx
  on projects (user_id, type) where status = 'active';

-- Один и тот же адрес не может занять два слота одного топа.
create unique index projects_one_active_per_url_and_type_idx
  on projects (url, type) where status = 'active';

create index projects_category_idx on projects (category_id);

create or replace function set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- type и category_id неизменяемы после создания: смена типа — обходной путь
-- к конвертации накопленной бесплатной репутации в платную позицию, смена
-- категории — обход перевода проекта в чужую витрину задним числом. Оба
-- правила стоят в 01 Механики рядом и по одной причине держатся на триггере,
-- а не на дисциплине кода — все операции идут под service_role, которому
-- RLS не указ, а триггер указ.
create or replace function forbid_project_identity_change() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.type is distinct from old.type then
    raise exception 'projects.type неизменяем после создания (% -> %)', old.type, new.type
      using errcode = 'check_violation';
  end if;
  if new.category_id is distinct from old.category_id then
    raise exception 'projects.category_id неизменяем после создания (% -> %)', old.category_id, new.category_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger projects_identity_is_immutable
  before update of type, category_id on projects
  for each row execute function forbid_project_identity_change();

-- Дедупликация кликов, не аналитика: конфликт по первичному ключу означает
-- «этот человек уже кликал сюда сегодня» — счётчик не растёт.
create table project_clicks (
  project_id bigint not null references projects (id),
  user_id    uuid   not null references users (id),
  day        date   not null,

  primary key (project_id, user_id, day)
);

-- ---------------------------------------------------------------------------
-- 4. Задания
-- ---------------------------------------------------------------------------

create table tasks (
  id                bigserial   primary key,
  type              text        not null check (type in ('visit', 'subscribe', 'referral')),
  title             text        not null,
  description       text,
  reward_votes      bigint      not null check (reward_votes > 0),
  target_project_id bigint      references projects (id),
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now()
);

create index tasks_target_project_idx on tasks (target_project_id) where target_project_id is not null;

create table task_completions (
  id           bigserial   primary key,
  task_id      bigint      not null references tasks (id),
  user_id      uuid        not null references users (id),
  project_id   bigint      references projects (id),
  reward_votes bigint      not null check (reward_votes > 0),
  status       text        not null check (status in ('pending', 'completed', 'rejected')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),

  -- Главная анти-фрод защита Free-механики. NULLS NOT DISTINCT обязателен:
  -- у referral-заданий project_id пустой, и при обычном UNIQUE такие строки
  -- считались бы разными — задание засчитывалось бы сколько угодно раз.
  constraint task_completions_once_per_user_task_project
    unique nulls not distinct (user_id, task_id, project_id)
);

create index task_completions_user_idx on task_completions (user_id);
create index task_completions_project_idx on task_completions (project_id) where project_id is not null;

create table vote_transactions (
  id           bigserial   primary key,
  user_id      uuid        not null references users (id),
  project_id   bigint      not null references projects (id),
  amount       bigint      not null,
  source       text        not null check (source in ('task', 'referral', 'manual', 'admin')),
  reference_id bigint,
  created_at   timestamptz not null default now()
);

comment on column vote_transactions.user_id is 'Кто отдал голоса';
comment on column vote_transactions.project_id is 'Кому отданы голоса';
comment on column vote_transactions.reference_id is 'id task_completion, если source = task';

create index vote_transactions_project_idx on vote_transactions (project_id);
create index vote_transactions_user_idx on vote_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Деньги
-- ---------------------------------------------------------------------------

-- Источник правды по реальным деньгам, для сверки с провайдером.
create table payment_transactions (
  id                  uuid           primary key default gen_random_uuid(),
  user_id             uuid           not null references users (id),
  project_id          bigint         not null references projects (id),
  target_project_id   bigint         references projects (id),
  intent              text           not null check (intent in ('raise', 'attack')),

  provider            text           not null check (provider in ('globalpay', 'platega', 'paddle', 'telegram_stars')),
  provider_payment_id text,
  provider_event_id   text,

  original_currency   text           not null check (original_currency in ('UZS', 'RUB', 'USD', 'XTR')),
  original_amount     bigint         not null check (original_amount > 0),
  fx_rate_used        numeric(20,10) not null check (fx_rate_used > 0),
  points_granted      bigint         not null check (points_granted >= 0),

  status              text           not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'disputed')),
  created_at          timestamptz    not null default now(),
  confirmed_at        timestamptz,

  -- Идемпотентность: один и тот же event провайдера не применяется дважды.
  -- NULL здесь распределяются как различные — это нужно, иначе второй платёж
  -- в статусе pending (event ещё не пришёл) конфликтовал бы с первым.
  constraint payment_transactions_provider_event_unique unique (provider, provider_event_id),

  constraint payment_transactions_target_matches_intent
    check ((intent = 'attack' and target_project_id is not null)
        or (intent = 'raise'  and target_project_id is null)),

  constraint payment_transactions_no_self_attack
    check (target_project_id is null or target_project_id <> project_id)
);

comment on column payment_transactions.original_amount is 'Ровно столько, сколько заплатил человек. Никогда не пересчитывается';
comment on column payment_transactions.fx_rate_used is 'Курс на момент платежа: изменение конфига не переписывает историю';

create index payment_transactions_user_idx on payment_transactions (user_id, created_at desc);
create index payment_transactions_project_idx on payment_transactions (project_id);
create index payment_transactions_pending_idx on payment_transactions (created_at) where status = 'pending';

-- Эффект платежа на игровые счётчики. Отдельно от payment_transactions:
-- одна таблица отвечает «сколько нам реально заплатили», другая — «как это
-- отразилось на витрине».
create table stake_transactions (
  id                   bigserial     primary key,
  transaction_group_id uuid          not null,
  payment_id           uuid          references payment_transactions (id),
  actor_user_id        uuid          not null references users (id),
  project_id           bigint        not null references projects (id),
  target_project_id    bigint        references projects (id),
  amount               bigint        not null,
  type                 text          not null check (type in ('raise', 'attack_out', 'attack_in')),
  coefficient          numeric(5,4)  check (coefficient is null or (coefficient > 0 and coefficient <= 1)),
  created_at           timestamptz   not null default now(),

  constraint stake_transactions_amount_sign
    check ((type = 'attack_out' and amount < 0)
        or (type in ('raise', 'attack_in') and amount > 0))
);

comment on column stake_transactions.transaction_group_id is 'Связывает attack_out и attack_in одной атаки';
comment on column stake_transactions.project_id is 'Чей счётчик меняется';
comment on column stake_transactions.amount is 'Со знаком: attack_out отрицательный';
comment on column stake_transactions.coefficient is 'Применённый хейркат, для attack_in';

-- Горячий индекс для расчёта decay-коэффициента: он считается под блокировкой
-- строк в каждой атаке, seq scan там недопустим.
create index stake_transactions_haircut_idx
  on stake_transactions (actor_user_id, target_project_id, created_at desc)
  where type = 'attack_out';

create index stake_transactions_project_idx on stake_transactions (project_id);
create index stake_transactions_payment_idx on stake_transactions (payment_id) where payment_id is not null;
create index stake_transactions_group_idx on stake_transactions (transaction_group_id);

-- ---------------------------------------------------------------------------
-- 6. Модерация и служебное
-- ---------------------------------------------------------------------------

create table moderation_actions (
  id         bigserial   primary key,
  project_id bigint      references projects (id),
  user_id    uuid        references users (id),
  action     text        not null check (action in ('block', 'unblock', 'hide')),
  reason     text,
  actor      text        not null,
  created_at timestamptz not null default now()
);

create index moderation_actions_project_idx on moderation_actions (project_id, created_at desc);

-- Лимиты, курсы и награды за задания. Смысл — подкручивать баланс без деплоя.
create table app_config (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

create trigger app_config_set_updated_at
  before update on app_config
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
-- Включаем на всех таблицах сразу, даже там, где политик пока нет: таблица с
-- включённым RLS и без политик недоступна никому, кроме service_role. Всё, что
-- двигает деньги или голоса, идёт только через Edge Functions с service_role.

alter table categories          enable row level security;
alter table users               enable row level security;
alter table auth_identities     enable row level security;
alter table projects            enable row level security;
alter table project_clicks      enable row level security;
alter table tasks               enable row level security;
alter table task_completions    enable row level security;
alter table vote_transactions   enable row level security;
alter table payment_transactions enable row level security;
alter table stake_transactions  enable row level security;
alter table moderation_actions  enable row level security;
alter table app_config          enable row level security;

-- Одной RLS мало: таблица без политик отдаёт анониму пустой результат, а не
-- отказ. Забираем права целиком и раздаём обратно только читаемые витрины —
-- тогда запрос к платёжной истории с фронта падает с permission denied.
revoke all on all tables in schema public from anon, authenticated;

grant select on categories, projects, tasks to anon, authenticated;

create policy categories_read_active on categories
  for select to anon, authenticated using (is_active);

create policy projects_read_active on projects
  for select to anon, authenticated using (status = 'active');

create policy tasks_read_active on tasks
  for select to anon, authenticated using (is_active);

-- users: RLS отбирает строки, column-level grant — колонки. Всё остальное
-- (баланс голосов, валюта отображения, статус) — только через Edge Function.
grant select (id, display_name, avatar_url, created_at) on users to anon, authenticated;

create policy users_read_public on users
  for select to anon, authenticated using (status = 'active');

-- Позиция в топе меняется без перезагрузки — projects читается через Realtime,
-- под теми же RLS-политиками.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table projects;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Seed
-- ---------------------------------------------------------------------------

insert into categories (slug, title, sort_order) values
  ('channels', 'Channels', 1),
  ('bots',     'Bots',     2),
  ('sites',    'Sites',    3),
  ('business', 'Business', 4),
  ('services', 'Services', 5)
on conflict (slug) do nothing;

-- Проценты хранятся целыми, чтобы в конфиге не заводилась дробная арифметика.
insert into app_config (key, value) values
  ('paid_limits', jsonb_build_object(
    'min_paid_amount',                50000,
    'min_attack_amount',              10000,
    'max_attacks_per_target_per_day',     3,
    'max_attacks_total_per_day',         10,
    'attack_floor_pct_of_initial',       50,
    'attack_haircut_floor_pct',          50,
    'attack_haircut_step_pct',           15,
    'attack_haircut_reset_hours',        48
  )),
  -- Курсы фиксированные: топ не должен дёргаться от колебаний рынка, а внешняя
  -- зависимость в платёжном пути — лишняя точка отказа. Перепроверить перед запуском.
  ('fx_rates', jsonb_build_object(
    'point_anchor_currency', 'UZS',
    'rub_to_uzs',              135,
    'usd_to_uzs',            12100
  )),
  ('task_rewards', jsonb_build_object(
    'visit',     1,
    'subscribe', 2,
    'referral',  3
  ))
on conflict (key) do nothing;
