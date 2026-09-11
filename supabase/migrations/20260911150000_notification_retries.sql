-- Разбор ревью среза 1.9. Четыре находки из семи живут здесь, и все четыре про
-- одно и то же: у строки очереди было два состояния вместо четырёх.
--
-- Было: `sent_at is null` означало одновременно «ждёт своего окна», «прямо
-- сейчас отправляется», «сорвалось, надо повторить» и «повторять
-- бесполезно». Индекс агрегации построен по этому же признаку — и отсюда
-- четыре разных беды:
--
--   1. **Погашенная строка навсегда съедала свой ключ.** `drop_notification`
--      ставил `attempts = 5`, но `sent_at` оставлял пустым: строка оставалась в
--      `notifications_pending_key`, а `claim_notifications` её больше не брал
--      (`attempts < 5`). Человек, не начинавший диалога с ботом, получал 403 на
--      первое же уведомление — и дальше КАЖДАЯ атака по этому проекту молча
--      вливалась в мёртвую строку. Даже после того, как он нажмёт `/start`.
--      У `referral` ключ пустой, так что одна такая строка убивала весь вид.
--
--   2. **События, случившиеся во время отправки, пропадали.** Строка
--      оставалась целью склейки всё время HTTP-запроса в Telegram: вторая атака
--      успевала влиться в неё, после чего `mark_notification_sent` помечал
--      строку отправленной вместе с непоказанным событием.
--
--   3. **Весь запас попыток сгорал за пять минут.** Расписание тикает раз в
--      минуту, а неудача не двигала `send_after` — значит шестиминутная
--      недоступность Telegram стоила очереди целиком, хотя это ровно тот
--      случай, ради которого попытки и заведены.
--
--   4. Строка, у которой попытки кончились сами, вела себя как погашенная из
--      пункта 1 — по той же причине.
--
-- Стало: два отдельных признака. `claimed_at` — «взята в работу», `dead_at` —
-- «закрыта навсегда». Индекс агрегации сужен до строк, которые ещё имеет смысл
-- склеивать, и всё перечисленное закрывается им одним: мёртвая строка выходит
-- из индекса, и следующее событие заводит новую; взятая в работу — тоже, и
-- событие во время отправки станет отдельным сообщением вместо потерянного.
alter table notifications
  add column claimed_at timestamptz,
  add column dead_at    timestamptz;

comment on column notifications.claimed_at is 'Взята отправщиком; пустая снова, если попытка сорвалась';
comment on column notifications.dead_at is 'Закрыта навсегда: 403 от Telegram или кончились попытки';

-- Ключ агрегации: только то, что ещё ждёт отправки и ещё может склеиться.
drop index notifications_pending_key;
create unique index notifications_pending_key
  on notifications (user_id, kind, group_key)
  where sent_at is null and dead_at is null and claimed_at is null;

drop index notifications_due;
create index notifications_due
  on notifications (send_after) where sent_at is null and dead_at is null;

-- ---------------------------------------------------------------------------
-- Постановка в очередь: цель склейки сузилась вместе с индексом
-- ---------------------------------------------------------------------------
create or replace function enqueue_notification(
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
  on conflict (user_id, kind, group_key)
    where sent_at is null and dead_at is null and claimed_at is null
    do update
     set payload = notifications.payload || excluded.payload || jsonb_strip_nulls(jsonb_build_object(
           'count',  coalesce((notifications.payload ->> 'count')::int, 1) + 1,
           'amount', case
                       when notifications.payload ? 'amount' or excluded.payload ? 'amount'
                       then coalesce((notifications.payload ->> 'amount')::bigint, 0)
                          + coalesce((excluded.payload ->> 'amount')::bigint, 0)
                     end,
           'rank_before', notifications.payload ->> 'rank_before'
         ));
end;
$$;

revoke all on function enqueue_notification(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function enqueue_notification(uuid, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Захват: помечает строку взятой и подбирает зависшие
-- ---------------------------------------------------------------------------
--
-- Зависшая строка — та, у которой `claimed_at` стоит, а отметки о результате
-- так и не пришло: отправщик умер между захватом и ответом. Через пять минут
-- она снова доступна. Без этого такая строка не пропала бы из очереди, но и не
-- ушла бы никогда — худший вид потери, невидимый в данных.
create or replace function claim_notifications(p_limit int default 25)
returns table (
  id            bigint,
  kind          text,
  payload       jsonb,
  chat_id       text,
  language_code text
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  with due as (
    select n.id
      from public.notifications n
     where n.sent_at is null
       and n.dead_at is null
       and n.send_after <= now()
       and n.attempts < 5
       and (n.claimed_at is null or n.claimed_at < now() - interval '5 minutes')
     order by n.send_after
     limit greatest(1, coalesce(p_limit, 25))
     for update skip locked
  ),
  claimed as (
    update public.notifications n
       set attempts = n.attempts + 1,
           claimed_at = now()
      from due
     where n.id = due.id
     returning n.id, n.kind, n.payload, n.user_id
  )
  select c.id, c.kind, c.payload, ai.provider_uid,
         coalesce(u.language, ai.meta ->> 'language_code')
    from claimed c
    join public.auth_identities ai
      on ai.user_id = c.user_id and ai.provider = 'telegram'
    join public.users u
      on u.id = c.user_id;
end;
$$;

revoke all on function claim_notifications(int) from public, anon, authenticated;
grant execute on function claim_notifications(int) to service_role;

-- ---------------------------------------------------------------------------
-- Отметки о результате
-- ---------------------------------------------------------------------------
--
-- Неудача отпускает захват и отодвигает строку: 2 минуты, 4, 8, 16, потолок —
-- час. Только с этим `attempts < 5` означает «пять настоящих попыток», а не
-- «пять минут».
create or replace function mark_notification_failed(p_id bigint, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.notifications
     set last_error = left(coalesce(p_error, ''), 500),
         claimed_at = null,
         send_after = now() + make_interval(
           secs => least(3600, 120 * (2 ^ greatest(attempts - 1, 0)))::int
         ),
         -- Исчерпанная строка закрывается здесь же: иначе она осталась бы
         -- лежать неотправленной навсегда, и разница между «ещё попробуем» и
         -- «уже нет» была бы видна только вычитанием в голове.
         dead_at = case when attempts >= 5 then now() end
   where id = p_id and sent_at is null and dead_at is null;
$$;

create or replace function drop_notification(p_id bigint, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.notifications
     set dead_at = now(),
         claimed_at = null,
         last_error = left(coalesce(p_error, ''), 500)
   where id = p_id and sent_at is null and dead_at is null;
$$;

revoke all on function mark_notification_failed(bigint, text) from public, anon, authenticated;
revoke all on function drop_notification(bigint, text) from public, anon, authenticated;
grant execute on function mark_notification_failed(bigint, text) to service_role;
grant execute on function drop_notification(bigint, text) to service_role;
