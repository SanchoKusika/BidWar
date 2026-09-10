-- Правки трёх дефектов, найденных код-ревью среза 1.7.

-- ---------------------------------------------------------------------------
-- 1. Одно задание на подписку на проект — держит база, а не аккуратность
-- ---------------------------------------------------------------------------
--
-- `apply_channel_admin` страховала вставку через `where not exists`, и за этой
-- проверкой не стояло ничего: ни блокировки, ни уникального ключа. У функции
-- два входа, и по замыслу они срабатывают через секунды друг от друга —
-- владелец жмёт «Проверить», а Telegram присылает `my_chat_member` о том, что
-- бота повысили. Оба вызова успевали пройти проверку до чужого коммита и
-- вставляли задание дважды.
--
-- Закрыто индексом, а не осторожностью вызывающего, — тем же способом, что и
-- правило «одна активная запись на пользователя»: инвариант, живущий в коде,
-- отстоит от нарушения на одного нового вызывающего.
create unique index if not exists tasks_one_subscribe_per_project_idx
  on tasks (target_project_id) where type = 'subscribe';

-- ---------------------------------------------------------------------------
-- 2. Совпадение по юзернейму канала — без шаблонов
-- ---------------------------------------------------------------------------
--
-- Раньше сравнение шло через `url like '%t.me/' || username`. В юзернеймах
-- Telegram бывает `_`, а `_` в LIKE означает «любой один символ»: канал
-- `my_channel` совпадал и с проектом на `t.me/myXchannel`. Комментарий прямо
-- над этой строкой утверждал, что шаблон точный, — он рассуждал только про
-- префикс и ни разу про язык шаблонов.
--
-- Теперь юзернейм вырезается из ссылки и сравнивается через `=`. Шаблона нет,
-- значит нечего экранировать и не в чем ошибиться позже: первый `split_part`
-- берёт то, что идёт после `t.me/`, второй отбрасывает хвост пути — ровно то
-- же, что делает `channelUsername` на стороне TypeScript со ссылками вида
-- `t.me/name/123`.
create or replace function apply_channel_admin(
  p_chat_id  bigint,
  p_username text,
  p_is_admin boolean
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_project public.projects;
  v_reward  bigint;
begin
  -- `for update` здесь не ради чтения: всё ниже пишет, а два входа гоняются
  -- наперегонки по замыслу. Блокировка строки проекта выстраивает их в
  -- очередь; уникальный индекс выше — страховка, а не основной план.
  select p.* into v_project
    from public.projects p
   where p.type = 'paid'
     and p.status = 'active'
     and (
       (p_chat_id is not null and p.tg_chat_id = p_chat_id)
       or (
         p_username is not null
         and lower(split_part(split_part(rtrim(p.url, '/'), 't.me/', 2), '/', 1))
             = lower(p_username)
       )
     )
   -- Совпадение по chat_id точнее совпадения по ссылке.
   order by (p.tg_chat_id is not distinct from p_chat_id) desc
   limit 1
     for update;

  if v_project.id is null then
    return null;
  end if;

  update public.projects
     set tg_chat_id = coalesce(p_chat_id, tg_chat_id),
         tg_bot_is_admin = p_is_admin
   where id = v_project.id;

  if not p_is_admin then
    -- Прав больше нет — проверять подписку нечем. Задание уходит с экрана, а
    -- уже начисленные за него голоса остаются: отзыв наград задним числом в
    -- Этап 1 не входит (09 Открытые вопросы).
    update public.tasks
       set is_active = false
     where type = 'subscribe' and target_project_id = v_project.id;
    return v_project.id;
  end if;

  select (value ->> 'subscribe')::bigint into v_reward
    from public.app_config where key = 'task_rewards';

  insert into public.tasks (type, title, description, reward_votes, target_project_id)
  values (
    'subscribe',
    'Subscribe to ' || coalesce('@' || p_username, v_project.name),
    'Stay subscribed to keep the votes.',
    coalesce(v_reward, 2),
    v_project.id
  )
  on conflict do nothing;

  -- Бота вернули после удаления — задание оживает вместе с правами, а не
  -- заводится вторым.
  update public.tasks
     set is_active = true
   where type = 'subscribe' and target_project_id = v_project.id and not is_active;

  return v_project.id;
end;
$$;

revoke all on function apply_channel_admin from public;
grant execute on function apply_channel_admin to service_role;

-- ---------------------------------------------------------------------------
-- 3. Засчитанное задание возвращает получившийся баланс
-- ---------------------------------------------------------------------------
--
-- Функция возвращала только начисленное, и экрану заданий приходилось
-- складывать его с балансом, который он держал, — тем самым пересчётом на
-- клиенте, который запрещает комментарий у `applyVoteBalance` и которого
-- избегает `cast_votes`, возвращая `balance_after`. Показанное число могло
-- врать двумя способами: кэшированный баланс мог отставать от голоса,
-- отданного на другой вкладке, а доплаты за приглашённого в `granted` нет.
--
-- Тип возврата меняется, поэтому функция пересоздаётся. По сигнатуре от неё
-- никто не зависит: `register_project_click` зовёт её через `perform`, а его
-- plpgsql разрешает во время выполнения.
drop function if exists apply_task_completion(uuid, text, bigint);

create function apply_task_completion(
  p_user_id    uuid,
  p_task_type  text,
  p_project_id bigint default null
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
  -- Задание под конкретный проект перебивает общее: у subscribe строка своя на
  -- канал, у visit общая на всех.
  select * into v_task
    from public.tasks t
   where t.type = p_task_type
     and t.is_active
     and (t.target_project_id is null or t.target_project_id = p_project_id)
   order by t.target_project_id nulls last
   limit 1;

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
