-- Срез 1.9: уведомления. Здесь только данные и правила их появления —
-- отправка и расписание следующим шагом, отдельной функцией.
--
-- Четыре решения, принятые 11.09.2026:
--
--   1. **Уведомления висят на леджере, а не внутри денежного пути.** Соблазн
--      был дописать `enqueue` в `apply_payment`: событие рождается там. Но
--      каждая такая правка переписывает единственную хранимку, двигающую
--      деньги, ради строчки, которая денег не касается. Вместо этого четыре
--      триггера читают уже записанное: подтверждённый платёж, снятую отметку
--      `rank1_since`, строку `vote_transactions`, строку награды за друга.
--      `apply_payment`, `cast_votes` и `apply_task_completion` этой миграцией
--      не меняются ни на строчку — и по той же причине, по которой стрелки
--      изменения посчитались из леджера, а не из таблицы снапшотов.
--
--   2. **Триггер не имеет права уронить платёж.** Тело каждого — под
--      `exception when others then return new`: непосланное уведомление это
--      неприятность, откаченная оплата — деньги. Цена — по подтранзакции на
--      событие, на этих объёмах незаметная.
--
--   3. **Настройки уведомлений живут в базе, а не в `localStorage`.**
--      Остальные настройки — про устройство зрителя, и стор поверх
--      `localStorage` для них правильный. Эту читает бот на сервере, которому
--      браузерного хранилища не видно. Четыре колонки, а не JSONB: отправка
--      фильтрует по ним в SQL, а опечатка в ключе JSONB молча значила бы
--      «выключено».
--
--   4. **Агрегация — это частичный уникальный индекс, а не логика в
--      отправщике.** Пока строка не отправлена, вторая такая же в неё
--      вливается: счётчик растёт, суммы складываются, `send_after` остаётся от
--      первой. Иначе серия атак превращается в серию сообщений — прямой путь в
--      блок по политике Telegram (06 Telegram-бот и Mini App).

-- ---------------------------------------------------------------------------
-- 1. Что человек согласен получать
-- ---------------------------------------------------------------------------
--
-- По умолчанию включено всё: продукт, где позицию отбирают, без уведомления об
-- атаке бесполезен — человек узнает о потере, когда зайдёт сам, то есть
-- никогда. Выключение остаётся за ним.
alter table users
  add column notify_attacked  boolean not null default true,
  add column notify_rank_lost boolean not null default true,
  add column notify_votes     boolean not null default true,
  add column notify_referral  boolean not null default true;

comment on column users.notify_attacked  is 'Слать сообщение, когда по проекту ударили';
comment on column users.notify_rank_lost is 'Слать сообщение, когда проект потерял первое место';
comment on column users.notify_referral  is 'Слать сообщение, когда приглашённый принёс голоса';
comment on column users.notify_votes     is 'Слать дайджест голосов за проект';

-- ---------------------------------------------------------------------------
-- 2. Очередь
-- ---------------------------------------------------------------------------
--
-- Очередь, а не прямая отправка, по двум причинам сразу. Во-первых, событие
-- рождается внутри транзакции, которая ещё может откатиться, — отправленное
-- сообщение откатить нельзя, строку в очереди можно. Во-вторых, агрегация: три
-- атаки подряд обязаны стать одним сообщением, а склеивать уже отправленное
-- нечем.
create table notifications (
  id         bigserial   primary key,
  user_id    uuid        not null references users (id),
  kind       text        not null check (kind in ('attacked', 'rank_lost', 'votes', 'referral')),

  -- Внутри чего склеивать. Для событий про проект это его id: две атаки по
  -- разным проектам одного человека — два разных сообщения, а не одно про
  -- «твои проекты». У награды за друга ключа нет: друзья складываются.
  group_key  text        not null default '',
  payload    jsonb       not null default '{}'::jsonb,

  -- Окно склейки: до этого момента строка ждёт соседей. Берётся от ПЕРВОГО
  -- события, поэтому поток атак не отодвигает сообщение бесконечно.
  send_after timestamptz not null default now(),
  sent_at    timestamptz,
  attempts   int         not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now()
);

comment on table notifications is
  'Очередь сообщений бота. Пишется триггерами по факту события, разбирается функцией notify';

-- Ключ агрегации. Частичный — по отправленным строкам склеивать нечего, и
-- вчерашнее сообщение не должно мешать сегодняшнему.
create unique index notifications_pending_key
  on notifications (user_id, kind, group_key) where sent_at is null;

-- Выборка отправщика: «что уже созрело».
create index notifications_due
  on notifications (send_after) where sent_at is null;

alter table notifications enable row level security;

-- Политик нет и не будет: очередь читается только service_role, как и
-- payment_transactions. `revoke` явный, потому что общий revoke первой миграции
-- накрыл таблицы, существовавшие на тот момент, а не эту.
revoke all on notifications from anon, authenticated;
revoke all on sequence notifications_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Окна склейки — в конфиге, как лимиты и награды
-- ---------------------------------------------------------------------------
--
-- Подкручивать частоту сообщений придётся по живым жалобам, и деплой ради
-- этого — лишний. Дайджест голосов реже остальных: голос это не потеря, ждать
-- его не больно.
insert into app_config (key, value) values
  ('notification_delays', jsonb_build_object(
    'attacked',    120,
    'rank_lost',   120,
    'votes',     10800,
    'referral',    120
  ))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Единственное место, где уведомление попадает в очередь
-- ---------------------------------------------------------------------------
--
-- Проверка настройки стоит здесь, на записи, а не на отправке: выключенное
-- уведомление не должно даже лежать в очереди. Обратная сторона осознанная —
-- включив настройку, человек не получит пропущенное задним числом. Это и
-- правильно: несостоявшееся сообщение об атаке двухдневной давности бесполезно.
create function enqueue_notification(
  p_user_id   uuid,
  p_kind      text,
  p_group_key text,
  p_payload   jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_allowed boolean;
  v_delay   int;
begin
  if p_user_id is null then
    return;
  end if;

  select case p_kind
           when 'attacked'  then u.notify_attacked
           when 'rank_lost' then u.notify_rank_lost
           when 'votes'     then u.notify_votes
           when 'referral'  then u.notify_referral
         end
    into v_allowed
    from public.users u
   where u.id = p_user_id and u.status = 'active';

  if v_allowed is not true then
    return;
  end if;

  select coalesce((c.value ->> p_kind)::int, 120) into v_delay
    from public.app_config c where c.key = 'notification_delays';

  insert into public.notifications (user_id, kind, group_key, payload, send_after)
  values (
    p_user_id,
    p_kind,
    coalesce(p_group_key, ''),
    p_payload || jsonb_build_object('count', 1),
    now() + make_interval(secs => coalesce(v_delay, 120))
  )
  on conflict (user_id, kind, group_key) where sent_at is null do update
     set payload = notifications.payload || excluded.payload || jsonb_strip_nulls(jsonb_build_object(
           'count',  coalesce((notifications.payload ->> 'count')::int, 1) + 1,
           -- Суммы складываются: «−150 000 тремя атаками», а не «−50 000»
           -- трижды. Ключа нет там, где складывать нечего (потеря места).
           'amount', case
                       when notifications.payload ? 'amount' or excluded.payload ? 'amount'
                       then coalesce((notifications.payload ->> 'amount')::bigint, 0)
                          + coalesce((excluded.payload ->> 'amount')::bigint, 0)
                     end,
           -- «Упал с #1 на #3»: первое число берётся от первого события окна,
           -- иначе после трёх атак человек прочтёт, что упал с #2 на #3.
           'rank_before', notifications.payload ->> 'rank_before'
         ));
end;
$$;

comment on function enqueue_notification is
  'Кладёт уведомление в очередь с учётом настроек получателя; повтор внутри окна склеивается с уже лежащим';

revoke all on function enqueue_notification(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function enqueue_notification(uuid, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Атака: сообщение жертве
-- ---------------------------------------------------------------------------
--
-- Триггер висит на подтверждении платежа, а не на строке леджера, ровно по
-- одной причине: к этому моменту обе записи атаки уже вставлены, и зачисление
-- атакующему видно. Без него «ранг до» пришлось бы считать в мире, где
-- атакующий уже поднялся, а жертва ещё не упала, — то есть ни до, ни после.
--
-- Имя атакующего в сообщении — требование [[06 Telegram-бот и Mini App]], и это
-- единственное место, где оно раскрывается: публичная лента событий автора
-- удара не показывает. Хендла у нас нет (его нет в `users` — см. флаг
-- `ownerHandle`), поэтому в сообщение идёт `display_name`.
create function notify_attacked()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target      public.projects;
  v_attacker    text;
  v_credited    bigint := 0;
  v_before      bigint;
  v_rank_before int;
  v_rank_after  int;
begin
  select * into v_target from public.projects p where p.id = new.target_project_id;
  if not found or v_target.user_id = new.user_id then
    return new;
  end if;

  select coalesce(sum(st.amount), 0) into v_credited
    from public.stake_transactions st
   where st.payment_id = new.id and st.type = 'attack_in';

  select u.display_name into v_attacker from public.users u where u.id = new.user_id;

  -- Состояние до платежа: цели вернуть отнятое, атакующему снять зачисленное.
  -- Тай-брейк тот же, что на витрине: больше очков, при равенстве — меньший id.
  v_before := v_target.paid_amount + new.points_granted;

  select count(*) + 1 into v_rank_before
    from public.projects p
   where p.type = 'paid' and p.status = 'active' and p.id <> v_target.id
     and (
       (p.paid_amount - case when p.id = new.project_id then v_credited else 0 end) > v_before
       or ((p.paid_amount - case when p.id = new.project_id then v_credited else 0 end) = v_before
           and p.id < v_target.id)
     );

  select count(*) + 1 into v_rank_after
    from public.projects p
   where p.type = 'paid' and p.status = 'active' and p.id <> v_target.id
     and (p.paid_amount > v_target.paid_amount
          or (p.paid_amount = v_target.paid_amount and p.id < v_target.id));

  perform public.enqueue_notification(
    v_target.user_id,
    'attacked',
    v_target.id::text,
    jsonb_build_object(
      'project_id',   v_target.id,
      'project_name', v_target.name,
      'attacker',     v_attacker,
      'amount',       new.points_granted,
      'rank_before',  v_rank_before,
      'rank_after',   v_rank_after
    )
  );

  return new;
exception
  when others then
    -- Решение 2 в шапке: платёж дороже сообщения.
    return new;
end;
$$;

create trigger payment_confirmed_notify_attacked
  after update of status on payment_transactions
  for each row
  when (
    new.status = 'confirmed'
    and old.status is distinct from 'confirmed'
    and new.intent = 'attack'
    and new.target_project_id is not null
  )
  execute function notify_attacked();

-- ---------------------------------------------------------------------------
-- 6. Потеря первого места
-- ---------------------------------------------------------------------------
--
-- Один триггер на оба топа и на все причины сразу: отметку снимают и
-- `apply_payment` (Raise перебил, Attack сбил), и `cast_votes` (перегнали
-- голосами). Само условие «был первым, перестал» — это и есть переход
-- `rank1_since` в null, и больше ему негде случиться.
create function notify_rank_lost()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  perform public.enqueue_notification(
    new.user_id,
    'rank_lost',
    new.id::text,
    jsonb_build_object(
      'project_id',   new.id,
      'project_name', new.name,
      'top',          new.type,
      'held_seconds', greatest(0, floor(extract(epoch from (now() - old.rank1_since)))::int)
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger projects_rank_lost_notify
  after update of rank1_since on projects
  for each row
  when (old.rank1_since is not null and new.rank1_since is null)
  execute function notify_rank_lost();

-- ---------------------------------------------------------------------------
-- 7. Голоса за проект — дайджестом
-- ---------------------------------------------------------------------------
--
-- Голос себе не уведомляется: человек только что нажал кнопку сам, сообщать
-- ему об этом — шум, за который отписываются от бота.
create function notify_votes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects p where p.id = new.project_id;
  if not found or v_project.user_id = new.user_id then
    return new;
  end if;

  perform public.enqueue_notification(
    v_project.user_id,
    'votes',
    v_project.id::text,
    jsonb_build_object(
      'project_id',   v_project.id,
      'project_name', v_project.name,
      'amount',       new.amount
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger vote_transactions_notify
  after insert on vote_transactions
  for each row
  execute function notify_votes();

-- ---------------------------------------------------------------------------
-- 8. Приглашённый дошёл до первого задания
-- ---------------------------------------------------------------------------
--
-- Строка награды за друга узнаётся по `referred_user_id`: так её отличает и
-- сама `apply_task_completion`, у которой на три поведения один ключ.
create function notify_referral()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.enqueue_notification(
    new.user_id,
    'referral',
    '',
    jsonb_build_object('amount', new.reward_votes)
  );

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger task_completions_notify_referral
  after insert on task_completions
  for each row
  when (new.referred_user_id is not null and new.status = 'completed')
  execute function notify_referral();
