-- У задания «зайти в проект» появляется предел: десять переходов в сутки.
--
-- Было: цель считалась размером платного топа, то есть «обойди ВСЕ платные
-- проекты». На витрине из восемнадцати это состояние практически недостижимо,
-- полоса прогресса показывала «5 из 18», и задание читалось как невыполнимое.
--
-- Десять — продуктовое число, поэтому лежит в `app_config` рядом с наградами, а
-- не константой в коде: крутить его будут по живым цифрам, и деплой ради этого
-- лишний.
--
-- Предел настоящий, а не подпись. Иначе одиннадцатый заход платил бы голос при
-- задании, которое уже показано выполненным, — то есть экран врал бы про
-- «готово», а голоса продолжали капать.
insert into app_config (key, value) values
  ('task_limits', jsonb_build_object('visit_per_day', 10))
on conflict (key) do nothing;

create or replace function apply_task_completion(
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
  v_visit_limit int;
  v_visits      int;
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

  -- Суточный предел переходов. Считается до блокировок и до вставки: дальше
  -- идти незачем, а `task_completions` и так хранит ровно те строки, по которым
  -- считается прогресс на экране.
  if v_task.type = 'visit' then
    select coalesce((c.value ->> 'visit_per_day')::int, 10) into v_visit_limit
      from public.app_config c where c.key = 'task_limits';

    select count(*) into v_visits
      from public.task_completions tc
     where tc.user_id = p_user_id
       and tc.task_id = v_task.id
       and tc.period_day = v_period
       and tc.status = 'completed';

    if v_visits >= coalesce(v_visit_limit, 10) then
      select u.vote_balance into v_balance from public.users u where u.id = p_user_id;
      return query select 0::bigint, 0::bigint, v_balance;
      return;
    end if;
  end if;

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

-- Строка задания больше не обещает «обойди всё»: число живёт в конфиге, а текст
-- в интерфейсе печатает клиент по типу задания.
update public.tasks
   set description = 'Open projects from the Paid Top. One vote per project, ten a day.'
 where type = 'visit' and target_project_id is null;
