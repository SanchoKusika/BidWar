-- Уведомления обращаются к человеку и называют того, кто его подвинул.
--
-- Было: «"Aleksandr K" больше не первый в платном топе. Держал 1 ч» — про
-- адресата в третьем лице, будто это новость о ком-то другом, и без ответа на
-- единственный вопрос, который у него возникнет: кто занял место.
--
-- Стало: сообщение на «ты», а в данных появляется имя занявшего. Берётся
-- телеграм-хендл из `auth_identities.meta`, и только если его нет — публичное
-- имя. Хендл здесь уместен ровно потому, что сообщение личное: в публичной
-- ленте автор события по-прежнему не показывается (06 Telegram-бот).

-- Хендл владельца проекта одной строкой. Отдельная функция, а не два
-- одинаковых подзапроса в двух триггерах: разъехались бы при первой же правке.
create function notification_handle(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select '@' || (ai.meta ->> 'username')
       from public.auth_identities ai
      where ai.user_id = p_user_id
        and ai.provider = 'telegram'
        and nullif(ai.meta ->> 'username', '') is not null
      limit 1),
    (select u.display_name from public.users u where u.id = p_user_id)
  );
$$;

revoke all on function notification_handle(uuid) from public, anon, authenticated;
grant execute on function notification_handle(uuid) to service_role;

create or replace function notify_attacked()
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

  v_attacker := public.notification_handle(new.user_id);

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
    return new;
end;
$$;

-- Кто занял место, считается здесь же: отметку с прежнего лидера снимают
-- раньше, чем ставят новому, но счётчики к этому моменту уже обновлены —
-- значит верхняя строка топа и есть тот, кто подвинул.
create or replace function notify_rank_lost()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_winner_user  uuid;
  v_winner_name  text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select p.user_id, p.name into v_winner_user, v_winner_name
    from public.projects p
   where p.type = new.type and p.status = 'active' and p.id <> new.id
   order by
     case when new.type = 'paid' then p.paid_amount else p.votes end desc,
     p.id asc
   limit 1;

  perform public.enqueue_notification(
    new.user_id,
    'rank_lost',
    new.id::text,
    jsonb_build_object(
      'project_id',    new.id,
      'project_name',  new.name,
      'top',           new.type,
      'held_seconds',  greatest(0, floor(extract(epoch from (now() - old.rank1_since)))::int),
      'winner',        public.notification_handle(v_winner_user),
      'winner_project', v_winner_name
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;
