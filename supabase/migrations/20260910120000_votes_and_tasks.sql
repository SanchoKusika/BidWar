-- Срез 1.7: голоса и задания. Данные и правила; выдача заданий наружу и экран —
-- следующим шагом.
--
-- Три решения приняты 10.09.2026 и лежат в 01 Механики / 03 Данные:
--
--   1. «Первое реальное действие» приглашённого, за которое капает награда
--      пригласившему, — это первое ВЫПОЛНЕННОЕ им задание, а не открытие
--      приложения. Открытие — ровно тот переход, который спека и отказалась
--      награждать.
--   2. `visit` возобновляется раз в сутки. При разовом засчитывании запас
--      голосов в системе конечен и равен «число людей × число платных
--      проектов»: сегодня это 18 голосов на аккаунт, после чего бесплатный
--      топ замирает. Он должен жить активностью людей, а не размером платного.
--   3. Награда за реферала идёт за КАЖДОГО друга. Одноразовый ключ выдал бы её
--      один раз за всю жизнь аккаунта — при том что и спека, и карточка в
--      приложении обещают награду за каждого.

-- ---------------------------------------------------------------------------
-- Один ключ на три поведения
-- ---------------------------------------------------------------------------
--
-- У трёх типов заданий «засчитывается один раз» означает разное, и это
-- разведено двумя пустующими колонками, а не тремя ограничениями и не
-- проверкой в коде:
--
--   subscribe  period_day = null,  referred_user_id = null  — навсегда
--   visit      period_day = дата,  referred_user_id = null  — раз в сутки
--   referral   period_day = null,  referred_user_id = друг  — раз на друга
--
-- `nulls not distinct` обязателен ровно по той же причине, по которой стоял в
-- исходном ключе: без него строки с пустыми колонками считались бы разными, и
-- subscribe засчитывался бы сколько угодно раз.
alter table task_completions
  add column period_day       date,
  add column referred_user_id uuid references users (id);

comment on column task_completions.period_day is 'Сутки засчитывания у возобновляемых заданий (visit); у остальных null';
comment on column task_completions.referred_user_id is 'За кого выдана награда у referral; у остальных null';

alter table task_completions
  drop constraint task_completions_once_per_user_task_project;

alter table task_completions
  add constraint task_completions_once_per_user_task_project
  unique nulls not distinct (user_id, task_id, project_id, period_day, referred_user_id);

-- ---------------------------------------------------------------------------
-- Строки заданий
-- ---------------------------------------------------------------------------
--
-- Задания встроенные, пользователи их не создают (01 Механики). `visit` и
-- `referral` — по одной общей строке на всю систему: какой именно проект
-- открыт, говорит `task_completions.project_id`, а не отдельная строка задания
-- на каждый проект. Иначе список заданий рос бы вместе с витриной.
--
-- `subscribe` устроен наоборот — он привязан к конкретному каналу и требует,
-- чтобы бот был там администратором. Такие строки появятся сами, когда владелец
-- канала добавит бота (`projects.tg_bot_is_admin`), и заводятся не здесь.
--
-- Награда берётся из `app_config.task_rewards` — того же места, откуда её
-- читает клиент. Дальше правда живёт в самой строке задания: засчитывание
-- платит `tasks.reward_votes`, а не лезет обратно в конфиг, иначе изменение
-- конфига задним числом переписало бы цену уже выданных наград.
insert into tasks (type, title, description, reward_votes)
select
  'visit',
  'Visit a project',
  'Open any project from the board. One vote per project, once a day.',
  (select (value ->> 'visit')::bigint from app_config where key = 'task_rewards')
where not exists (
  select 1 from tasks where type = 'visit' and target_project_id is null
);

insert into tasks (type, title, description, reward_votes)
select
  'referral',
  'Invite friends',
  'Votes land when the friend finishes their first task, not when they open the app.',
  (select (value ->> 'referral')::bigint from app_config where key = 'task_rewards')
where not exists (
  select 1 from tasks where type = 'referral' and target_project_id is null
);

-- ---------------------------------------------------------------------------
-- Засчитывание задания — единственное место, где голоса появляются
-- ---------------------------------------------------------------------------
--
-- То же правило, по которому `apply_payment` — единственное место, двигающее
-- деньги: две точки начисления неизбежно разъезжаются. Реферальная доплата
-- поэтому живёт здесь же, а не отдельной функцией «выдать награду за друга»:
-- закрывая первое задание новичка, функция сама проверяет, кто его привёл.
--
-- Идемпотентность держит ключ, а не проверка перед вставкой: конкурентный
-- повтор получит `on conflict do nothing` и уйдёт с нулём, а не со второй
-- наградой.
create function apply_task_completion(
  p_user_id    uuid,
  p_task_type  text,
  p_project_id bigint default null
)
returns table (granted bigint, referral_granted bigint)
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
    return query select 0::bigint, 0::bigint;
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
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  update public.users
     set vote_balance = vote_balance + v_task.reward_votes
   where id = p_user_id;

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

  return query select v_task.reward_votes, v_ref_granted;
end;
$$;

revoke all on function apply_task_completion from public;
grant execute on function apply_task_completion to service_role;

-- ---------------------------------------------------------------------------
-- Отдача голосов — единственное место, где голоса тратятся
-- ---------------------------------------------------------------------------
--
-- Голоса не обязаны идти в свой проект (01 Механики), поэтому проверки «это
-- твоя запись» здесь нет и быть не должно. Проверок ровно три: сумма
-- положительная, цель — активный бесплатный проект, баланса хватает.
--
-- Потолка на отдачу в Этапе 1 нет сознательно: rate limit на голосование
-- записан в Этап 3, а настоящий потолок — `users.vote_balance >= 0`, и он в
-- схеме. Отдать больше, чем заработал, нельзя.
--
-- Порядок блокировок: сначала users, потом projects, внутри projects — по
-- возрастанию id одним statement'ом до первого UPDATE. Набор строк тот же по
-- смыслу, что у apply_payment: цель, держатели `rank1_since` и топ-2 — потому
-- что новым лидером после начисления может стать только цель или прежний
-- первый, и оба обязаны быть взяты до апдейтов.
create function cast_votes(
  p_user_id    uuid,
  p_project_id bigint,
  p_amount     bigint
)
returns table (applied boolean, balance_after bigint, reason text)
language plpgsql
set search_path = ''
as $$
declare
  v_balance bigint;
  v_project public.projects;
  v_leader  bigint;
begin
  if p_amount is null or p_amount <= 0 then
    return query select false, null::bigint, 'bad_amount'::text;
    return;
  end if;

  select u.vote_balance into v_balance
    from public.users u
   where u.id = p_user_id
     for update;

  if not found then
    return query select false, null::bigint, 'no_user'::text;
    return;
  end if;

  perform 1 from public.projects
   where id = p_project_id
      or (type = 'free' and rank1_since is not null)
      or id in (
        select p.id from public.projects p
         where p.type = 'free' and p.status = 'active'
         order by p.votes desc, p.id asc
         limit 2
      )
   order by id
   for update;

  select * into v_project from public.projects where id = p_project_id;

  -- Платный проект целью быть не может: у него `votes = 0` держит ограничение
  -- projects_counters_exclusive, и голос туда просто не влезет.
  if v_project.id is null or v_project.type <> 'free' or v_project.status <> 'active' then
    return query select false, v_balance, 'bad_target'::text;
    return;
  end if;

  if v_balance < p_amount then
    return query select false, v_balance, 'insufficient_balance'::text;
    return;
  end if;

  update public.users set vote_balance = vote_balance - p_amount where id = p_user_id;
  update public.projects set votes = votes + p_amount where id = p_project_id;

  insert into public.vote_transactions (user_id, project_id, amount, source)
  values (p_user_id, p_project_id, p_amount, 'manual');

  -- rank1_since у бесплатного топа считается по голосам и тем же тай-брейком,
  -- что у платного по очкам. Оба UPDATE ниже сужены по `type`: отметка общая
  -- для двух топов, и снимать её без сужения означало бы сбивать лидера
  -- платного каждым голосом.
  select p.id into v_leader
    from public.projects p
   where p.type = 'free' and p.status = 'active'
   order by p.votes desc, p.id asc
   limit 1;

  update public.projects set rank1_since = null
   where type = 'free' and rank1_since is not null and id is distinct from v_leader;

  update public.projects set rank1_since = now()
   where id = v_leader and rank1_since is null;

  return query select true, v_balance - p_amount, null::text;
end;
$$;

revoke all on function cast_votes from public;
grant execute on function cast_votes to service_role;

-- ---------------------------------------------------------------------------
-- Клик засчитывает задание visit
-- ---------------------------------------------------------------------------
--
-- Отдельной кнопки «я сходил» не нужно: `visit` проверяется фактом открытия
-- ссылки через наш редирект (01 Механики), а он уже здесь — и уже с суточной
-- дедупликацией по (project_id, user_id, day). Ровно то же окно, что и у
-- задания, поэтому одно вытекает из другого без второй проверки.
--
-- Контракт функции намеренно не меняется: она по-прежнему возвращает boolean
-- «клик засчитан». Сколько голосов при этом начислено, спросит экран заданий у
-- своего API — а `click` задеплоен и работает, и менять его ответ одновременно
-- с миграцией значит ломать прод на время между двумя выкладками.
create or replace function register_project_click(p_project_id bigint, p_user_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_counted boolean;
begin
  insert into public.project_clicks (project_id, user_id, day)
  values (p_project_id, p_user_id, current_date)
  on conflict do nothing;

  v_counted := found;

  if v_counted then
    update public.projects set clicks = clicks + 1 where id = p_project_id;
    perform public.apply_task_completion(p_user_id, 'visit', p_project_id);
  end if;

  return v_counted;
end;
$$;
