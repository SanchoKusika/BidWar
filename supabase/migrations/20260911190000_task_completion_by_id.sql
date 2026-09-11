-- Засчитывать можно ИМЕННО то задание, которое проверяли.
--
-- Находка ревью PR #53, и она появилась вместе с заданием площадки. `check-
-- subscription` знал точный id задания, но передавал в хранимку только тип и
-- проект, а та выбирала строку заново:
--
--   where type = p_task_type and is_active
--     and (target_project_id is null or target_project_id = p_project_id)
--   order by target_project_id nulls last
--
-- Пока активной строки `subscribe` без проекта не существовало, промахнуться
-- было некуда. Теперь такая строка есть — и она стала запасным вариантом для
-- КАЖДОЙ проверки подписки. Сценарий: человек жмёт «Проверить» на канале
-- проекта; между чтением задания и вызовом хранимки (а это целый поход в Bot
-- API) владелец снимает права у бота, `apply_channel_admin` гасит строку
-- проекта — и хранимка молча засчитывает вместо неё подписку на @BidWar_world
-- тому, кто её не проверял. Задание площадки после этого закрыто для него
-- навсегда.
--
-- Лечится не проверкой, а тем, что вызывающий теперь передаёт id. Старый путь
-- остаётся для `register_project_click`, который задание не читает и знать его
-- id не может.
drop function if exists apply_task_completion(uuid, text, bigint);

create function apply_task_completion(
  p_user_id    uuid,
  p_task_type  text,
  p_project_id bigint default null,
  p_task_id    bigint default null
)
returns table (granted bigint, referral_granted bigint, balance_after bigint)
language plpgsql
set search_path = ''
as $$
declare
  v_task        public.tasks;
  v_ref_task    public.tasks;
  v_period      date;
  v_referrer    uuid;
  v_first       boolean;
  v_ref_granted bigint := 0;
  v_balance     bigint;
begin
  if p_task_id is not null then
    -- Тип всё равно сверяется: id приходит снаружи, и «засчитай мне задание
    -- номер такой-то» не должно уметь платить за чужой тип.
    select * into v_task
      from public.tasks t
     where t.id = p_task_id and t.type = p_task_type and t.is_active;
  else
    -- Задание под конкретный проект перебивает общее: у subscribe строка своя
    -- на канал, у visit общая на всех.
    select * into v_task
      from public.tasks t
     where t.type = p_task_type
       and t.is_active
       and (t.target_project_id is null or t.target_project_id = p_project_id)
     order by t.target_project_id nulls last
     limit 1;
  end if;

  if v_task.id is null then
    select u.vote_balance into v_balance from public.users u where u.id = p_user_id;
    return query select 0::bigint, 0::bigint, v_balance;
    return;
  end if;

  v_period := case when v_task.type = 'visit' then current_date end;

  select u.referrer_id into v_referrer from public.users u where u.id = p_user_id;

  -- Обе строки users одним statement'ом, по возрастанию id, до первого UPDATE —
  -- тот же порядок блокировок, что у apply_payment по projects. Реферер читается
  -- до блокировки намеренно: `users.referrer_id` проставляется один раз при
  -- регистрации и дальше не меняется, гонки на нём нет.
  perform 1 from public.users
   where id = p_user_id or id = v_referrer
   order by id
   for update;

  insert into public.task_completions
    (task_id, user_id, project_id, period_day, reward_votes, status, completed_at)
  values
    (v_task.id, p_user_id, p_project_id, v_period, v_task.reward_votes, 'completed', now())
  on conflict do nothing;

  if not found then
    -- Уже засчитано. Баланс всё равно возвращается, и именно текущий: повтор
    -- обязан оставить на экране правду, а не то число, которое вызывающий
    -- держал у себя.
    select u.vote_balance into v_balance from public.users u where u.id = p_user_id;
    return query select 0::bigint, 0::bigint, v_balance;
    return;
  end if;

  update public.users
     set vote_balance = vote_balance + v_task.reward_votes
   where id = p_user_id
   returning vote_balance into v_balance;

  -- Награда пригласившему — за ПЕРВОЕ выполненное задание новичка. Считаем уже
  -- после вставки, поэтому единица здесь означает «эта строка и есть первая».
  if v_referrer is not null then
    select count(*) = 1 into v_first
      from public.task_completions tc
     where tc.user_id = p_user_id and tc.status = 'completed';

    if v_first then
      select * into v_ref_task
        from public.tasks t
       where t.type = 'referral' and t.target_project_id is null and t.is_active
       limit 1;

      if v_ref_task.id is not null then
        insert into public.task_completions
          (task_id, user_id, referred_user_id, reward_votes, status, completed_at)
        values
          (v_ref_task.id, v_referrer, p_user_id, v_ref_task.reward_votes, 'completed', now())
        on conflict do nothing;

        if found then
          update public.users
             set vote_balance = vote_balance + v_ref_task.reward_votes
           where id = v_referrer;
          v_ref_granted := v_ref_task.reward_votes;
        end if;
      end if;
    end if;
  end if;

  -- `balance_after` — баланс самого действующего. Доплата пригласившему падает
  -- на другую строку и другой экран; вписать её в это число значило бы солгать
  -- ровно так же, как лгало сложение на клиенте.
  return query select v_task.reward_votes, v_ref_granted, v_balance;
end;
$$;

revoke all on function apply_task_completion from public;
grant execute on function apply_task_completion to service_role;

-- ---------------------------------------------------------------------------
-- Две дыры поменьше из того же ревью
-- ---------------------------------------------------------------------------
--
-- Ссылка у задания площадки обязательна. Без неё «Проверить» показывает
-- «мы открыли канал — подпишись и нажми ещё раз», не открывая ничего: экран
-- открывает `targetUrl`, а его нет. Ограничение выше обещало не пустить именно
-- такую строку — теперь обещание выполняется.
alter table tasks drop constraint tasks_subscribe_has_target;

alter table tasks
  add constraint tasks_subscribe_has_target
  check (
    type <> 'subscribe'
    or target_project_id is not null
    or (target_chat_id is not null and target_url is not null)
  );

-- Один канал — одна строка. `tasks_one_subscribe_per_project_idx` считает NULL
-- различными, поэтому заданий площадки можно было завести сколько угодно, и
-- выбор между ними решался бы `limit 1` без тай-брейка.
create unique index tasks_one_subscribe_per_chat_idx
  on tasks (target_chat_id)
  where type = 'subscribe' and target_chat_id is not null;
