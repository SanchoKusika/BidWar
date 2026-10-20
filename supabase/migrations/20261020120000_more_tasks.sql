-- More tasks: a daily streak, daily goals, step ladders and one-time actions.
--
-- Everything here is checked by the server, never taken from the client's
-- word: a task is either counted from rows the ledger already holds (votes
-- given, visits, streak days), or the Edge Function asks Telegram first
-- (a boost, a bot that can write) and passes the answer in as a fact.
--
-- Votes still appear in one place only — `apply_task_completion`. The new
-- `claim_task` decides whether a task is ready and what it pays, then hands
-- the row to it; the referral bonus and the friend-streak bonus live inside
-- it for the same reason the referral bonus always did.

-- ---------------------------------------------------------------------------
-- Types and the task's own numbers
-- ---------------------------------------------------------------------------
alter table public.tasks drop constraint tasks_type_check;
alter table public.tasks add constraint tasks_type_check check (type in (
  'visit', 'subscribe', 'referral',
  'daily_checkin', 'daily_votes', 'daily_visits', 'daily_scout',
  'ladder_streak', 'ladder_votes', 'ladder_backed', 'ladder_visits',
  'referral_streak',
  'add_project', 'bot_dm', 'boost', 'site_login', 'premium'
));

-- Goals and reward schedules live in the task row, next to `reward_votes`,
-- and for the same reason: a completion pays what the row said at the time,
-- and retuning the row later does not rewrite rewards already paid.
alter table public.tasks add column params jsonb not null default '{}'::jsonb;

comment on column public.tasks.params is
  'Goals and reward schedule of daily, ladder and streak tasks; {} for the rest';

-- ---------------------------------------------------------------------------
-- One key, two more behaviours
-- ---------------------------------------------------------------------------
--
--   ladder         step = the goal reached         — once per goal
--   daily_checkin  step = the day of the streak    — once a day (index below)
--
-- `step` joins the key so a ladder pays each goal once. The daily tasks get a
-- separate index on the day alone: the streak day is derived from yesterday's
-- row and is the same for every claim on a given day, but "once a day" should
-- not depend on that argument holding.
alter table public.task_completions add column step int;

comment on column public.task_completions.step is
  'Goal reached on a ladder, or the streak day of daily_checkin; null for the rest';

alter table public.task_completions
  drop constraint task_completions_once_per_user_task_project;

alter table public.task_completions
  add constraint task_completions_once_per_user_task_project
  unique nulls not distinct (user_id, task_id, project_id, period_day, referred_user_id, step);

create unique index task_completions_once_a_day_idx
  on public.task_completions (user_id, task_id, period_day)
  where project_id is null and referred_user_id is null and period_day is not null;

-- ---------------------------------------------------------------------------
-- Task rows
-- ---------------------------------------------------------------------------
--
-- Rewards are sized against what exists: a visit pays 1, a subscription 2, a
-- friend 3, and an active day of visits brings about ten. The new daily tasks
-- add roughly as much again for someone who comes back every day and gives
-- votes away; ladders pay rarely and grow slowly, so they cannot outrun it.
--
-- The boards start small: one project per person per top means as many
-- projects as people. Nothing here asks for more projects than exist — goals
-- that count other people's projects start at two and hide above the board,
-- and the quest of the day and the subscriptions ladder were dropped before
-- release for needing more of the board than the start has.
--
-- The daily bonus grows by one every day in a row and holds at ten: strictly
-- more each day with no ceiling would be thirty a day after a month, three
-- times a whole day of visits. Adding your own free project is the largest
-- single step of a newcomer and pays ten.
insert into public.tasks (type, title, description, reward_votes, params, target_chat_id, target_url)
select v.type, v.title, v.description, v.reward_votes, v.params::jsonb, v.target_chat_id, v.target_url
  from (values
    ('daily_checkin', 'Daily bonus', 'One more every day in a row, up to ten; a missed day starts over.', 1,
     '{"rewards": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}', null::bigint, null::text),
    ('daily_votes', 'Give votes today', 'Give votes to any free projects.', 2,
     '{"goal": 5}', null, null),
    ('daily_visits', 'Finish the day''s visits', 'Open every paid project the visit task asks for.', 2,
     '{"min_goal": 2}', null, null),
    ('daily_scout', 'Scout new projects', 'Open a paid project added in the last 24 hours.', 1,
     '{"window_hours": 24}', null, null),
    ('ladder_streak', 'Streak record', 'Days in a row with the daily bonus.', 2,
     '{"goals": [3, 7, 14, 30], "rewards": [2, 5, 10, 20], "step": 30}', null, null),
    ('ladder_votes', 'Votes given', 'All votes given, to any projects.', 2,
     '{"goals": [10, 50, 100, 250, 500], "rewards": [2, 5, 8, 15, 25], "step": 500}', null, null),
    ('ladder_backed', 'Projects backed', 'Different free projects you gave votes to.', 2,
     '{"goals": [2, 3, 5, 10], "rewards": [2, 3, 5, 10], "step": 10}', null, null),
    ('ladder_visits', 'Projects opened', 'All counted visits to paid projects.', 2,
     '{"goals": [10, 25, 50, 100, 250], "rewards": [2, 3, 5, 10, 15], "step": 250}', null, null),
    ('referral_streak', 'Friends on a streak', 'An invited friend keeps the daily bonus seven days in a row.', 5,
     '{"streak": 7}', null, null),
    ('add_project', 'Add your free project', 'Put your channel, bot or site on the Free Top.', 10,
     '{}', null, null),
    ('bot_dm', 'Let the bot write to you', 'Attacks, lost first place and votes arrive in the chat.', 2,
     '{}', null, null),
    ('boost', 'Boost @BidWar_world', 'A Telegram Premium boost of the channel.', 5,
     '{}', -1003948577309, 'https://t.me/boost/BidWar_world'),
    ('site_login', 'Sign in on bidwar.world', 'The same account on the website.', 2,
     '{}', null, null),
    ('premium', 'Telegram Premium bonus', 'Once, for a Premium account.', 3,
     '{}', null, null)
  ) as v(type, title, description, reward_votes, params, target_chat_id, target_url)
 where not exists (select 1 from public.tasks t where t.type = v.type);

-- ---------------------------------------------------------------------------
-- Ladder arithmetic
-- ---------------------------------------------------------------------------

-- The first goal above what is already claimed: 3 → 7 → 14 → 30, then +step
-- for good. The same rule as the referral ladder (`nextReferralGoal` in
-- `_shared/tasks.ts`), so no ladder ever ends on a finished «30 of 30».
create function public.ladder_next_goal(p_params jsonb, p_claimed int)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select g::int
       from jsonb_array_elements_text(p_params -> 'goals') g
      where g::int > p_claimed
      order by g::int
      limit 1),
    (select s.last + s.size * (greatest(0, p_claimed - s.last) / s.size + 1)
       from (select coalesce((p_params -> 'goals' ->> (jsonb_array_length(p_params -> 'goals') - 1))::int, 0) as last,
                    greatest(1, coalesce((p_params ->> 'step')::int, 1)) as size) s)
  );
$$;

-- What a goal pays: its own entry, and past the list the last one.
create function public.ladder_reward(p_params jsonb, p_goal int)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select (p_params -> 'rewards' ->> (e.i - 1)::int)::bigint
       from jsonb_array_elements_text(p_params -> 'goals') with ordinality e(g, i)
      where e.g::int = p_goal),
    (p_params -> 'rewards' ->> (jsonb_array_length(p_params -> 'rewards') - 1))::bigint
  );
$$;

-- ---------------------------------------------------------------------------
-- Where a task stands for one person
-- ---------------------------------------------------------------------------
--
-- One function answers both the board and the claim, so a card that says
-- «claim» and a claim that says «not yet» cannot disagree. A task that is not
-- returned is hidden: its goal cannot be reached right now (three projects to
-- back when the Free Top has two) or it is not for this person (a boost
-- without Premium) — a card nobody can finish lies about the task.
--
-- Facts come from the Edge Function and are things only it can know: where
-- the request came from (`site`), the Premium flag of the signed initData
-- (`premium`), and Telegram's answers (`boosted`, `bot_reachable`).
--
-- `p_task_id` narrows the loop to one task — the claim needs no other row.
--
-- Everything is read before `apply_task_completion` takes its lock. That is
-- safe because every number here only grows within a day, and a second claim
-- of the same step or day is caught by the key, not by this read.
create function public.task_progress(
  p_user_id uuid,
  p_facts   jsonb  default '{}'::jsonb,
  p_task_id bigint default null
)
returns table (
  task_id           bigint,
  state             text,
  current_value     int,
  goal              int,
  reward            bigint,
  claim_step        int,
  claim_period      date,
  target_project_id bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today          date := current_date;
  v_task           public.tasks;
  v_visit_task     bigint;
  v_visit_limit    int;
  v_paid_available int;
  v_free_available int;
  v_visits_today   int;
  v_visits_total   int;
  v_votes_today    bigint;
  v_votes_total    bigint;
  v_backed_total   int;
  v_checkin_today  int;
  v_checkin_prev   int;
  v_best_streak    int;
  v_has_free       boolean;
  v_done           boolean;
  v_done_today     boolean;
  v_claimed        int;
  v_metric         bigint;
  v_len            int;
  v_day            int;
  v_milestones     jsonb;
begin
  select t.id into v_visit_task
    from public.tasks t where t.type = 'visit' and t.target_project_id is null
   order by t.id limit 1;

  select coalesce((c.value ->> 'visit_per_day')::int, 10),
         jsonb_build_object(
           'goals', coalesce(c.value -> 'referral_milestones', '[1, 3, 5, 10]'::jsonb),
           'step',  coalesce((c.value ->> 'referral_milestone_step')::int, 10))
    into v_visit_limit, v_milestones
    from public.app_config c where c.key = 'task_limits';
  v_visit_limit := coalesce(v_visit_limit, 10);
  v_milestones := coalesce(v_milestones, '{"goals": [1, 3, 5, 10], "step": 10}'::jsonb);

  -- What there is to do at all. Own projects are left out of the paid side:
  -- a click on them does not count (register_project_click).
  select count(*)::int into v_paid_available
    from public.projects p
   where p.type = 'paid' and p.status = 'active' and p.user_id <> p_user_id;

  select count(*)::int into v_free_available
    from public.projects p where p.type = 'free' and p.status = 'active';

  select count(*) filter (where tc.period_day = v_today)::int, count(*)::int
    into v_visits_today, v_visits_total
    from public.task_completions tc
   where tc.user_id = p_user_id and tc.task_id = v_visit_task and tc.status = 'completed';

  select coalesce(sum(vt.amount) filter (where vt.created_at >= v_today), 0),
         coalesce(sum(vt.amount), 0),
         count(distinct vt.project_id)::int
    into v_votes_today, v_votes_total, v_backed_total
    from public.vote_transactions vt
   where vt.user_id = p_user_id;

  select max(tc.step) filter (where tc.period_day = v_today),
         max(tc.step) filter (where tc.period_day = v_today - 1),
         coalesce(max(tc.step), 0)
    into v_checkin_today, v_checkin_prev, v_best_streak
    from public.task_completions tc
    join public.tasks t on t.id = tc.task_id
   where tc.user_id = p_user_id and t.type = 'daily_checkin' and tc.status = 'completed';

  select exists (
    select 1 from public.projects p
     where p.user_id = p_user_id and p.type = 'free' and p.status = 'active'
  ) into v_has_free;

  for v_task in
    select * from public.tasks t
     where t.is_active
       and t.type not in ('visit', 'subscribe', 'referral')
       and (p_task_id is null or t.id = p_task_id)
     order by t.id
  loop
    task_id := v_task.id;
    state := 'available';
    current_value := null;
    goal := null;
    reward := v_task.reward_votes;
    claim_step := null;
    claim_period := null;
    target_project_id := null;

    select exists (
      select 1 from public.task_completions tc
       where tc.user_id = p_user_id and tc.task_id = v_task.id and tc.status = 'completed'
    ), exists (
      select 1 from public.task_completions tc
       where tc.user_id = p_user_id and tc.task_id = v_task.id
         and tc.status = 'completed' and tc.period_day = v_today
    ) into v_done, v_done_today;

    case v_task.type
    when 'daily_checkin' then
      -- Day N of the streak pays the N-th entry, and past the list the last
      -- one for as long as the streak lasts. The bar fills towards that
      -- ceiling and stays full there; the streak itself keeps counting for
      -- the record ladder.
      v_len := greatest(1, jsonb_array_length(v_task.params -> 'rewards'));
      v_day := coalesce(v_checkin_today, coalesce(v_checkin_prev, 0) + 1);
      goal := v_len;
      reward := (v_task.params -> 'rewards' ->> (least(v_day, v_len) - 1))::bigint;
      if v_checkin_today is not null then
        -- The bar counts days reached, like a ladder: today's is in once paid.
        current_value := least(v_day, v_len);
        state := 'done';
      else
        current_value := least(v_day - 1, v_len);
        state := 'ready';
        claim_step := v_day;
        claim_period := v_today;
      end if;

    when 'daily_votes' then
      if v_free_available = 0 and not v_done_today then continue; end if;
      goal := coalesce((v_task.params ->> 'goal')::int, 5);
      current_value := least(v_votes_today, goal);
      claim_period := v_today;
      state := case when v_done_today then 'done'
                    when v_votes_today >= goal then 'ready'
                    else 'available' end;

    when 'daily_visits' then
      goal := least(v_visit_limit, v_paid_available);
      if goal < coalesce((v_task.params ->> 'min_goal')::int, 3) and not v_done_today then
        continue;
      end if;
      current_value := least(v_visits_today, goal);
      claim_period := v_today;
      state := case when v_done_today then 'done'
                    when v_visits_today >= goal then 'ready'
                    else 'available' end;

    when 'daily_scout' then
      -- Counted by the click itself, like `visit`: nothing to claim. The card
      -- points at the newest new project not opened yet.
      select count(*)::int,
             count(tc.id)::int,
             (array_agg(p.id order by p.created_at desc) filter (where tc.id is null))[1]
        into goal, current_value, target_project_id
        from public.projects p
        left join public.task_completions tc
          on tc.task_id = v_task.id and tc.user_id = p_user_id and tc.project_id = p.id
       where p.type = 'paid' and p.status = 'active' and p.user_id <> p_user_id
         and p.created_at > now() - make_interval(
               hours => coalesce((v_task.params ->> 'window_hours')::int, 24));
      if goal = 0 then continue; end if;
      state := case when current_value >= goal then 'done' else 'available' end;

    when 'ladder_streak', 'ladder_votes', 'ladder_backed', 'ladder_visits' then
      select coalesce(max(tc.step), 0) into v_claimed
        from public.task_completions tc
       where tc.user_id = p_user_id and tc.task_id = v_task.id and tc.status = 'completed';

      v_metric := case v_task.type
        when 'ladder_streak' then v_best_streak
        when 'ladder_votes' then v_votes_total
        when 'ladder_backed' then v_backed_total
        else v_visits_total
      end;
      goal := public.ladder_next_goal(v_task.params, v_claimed);

      -- A goal above everything that exists cannot be reached: ten projects
      -- to back on a Free Top of six.
      if v_task.type = 'ladder_backed' and goal > greatest(v_free_available, v_metric) then continue; end if;

      current_value := least(v_metric, goal);
      reward := public.ladder_reward(v_task.params, goal);
      claim_step := goal;
      state := case when v_metric >= goal then 'ready' else 'available' end;

    when 'referral_streak' then
      -- Paid inside apply_task_completion when the friend's streak gets
      -- there; the card only shows the ladder, like `referral`.
      select count(*)::int into current_value
        from public.task_completions tc
       where tc.user_id = p_user_id and tc.task_id = v_task.id and tc.status = 'completed';
      goal := public.ladder_next_goal(v_milestones, current_value);

    when 'add_project' then
      state := case when v_done then 'done' when v_has_free then 'ready' else 'available' end;

    when 'bot_dm' then
      state := case when v_done then 'done'
                    when coalesce((p_facts ->> 'bot_reachable')::boolean, false) then 'ready'
                    else 'available' end;

    when 'boost' then
      if not v_done and not coalesce((p_facts ->> 'premium')::boolean, false) then continue; end if;
      state := case when v_done then 'done'
                    when coalesce((p_facts ->> 'boosted')::boolean, false) then 'ready'
                    else 'available' end;

    when 'site_login' then
      state := case when v_done then 'done'
                    when coalesce((p_facts ->> 'site')::boolean, false) then 'ready'
                    else 'available' end;

    when 'premium' then
      if not v_done and not coalesce((p_facts ->> 'premium')::boolean, false) then continue; end if;
      state := case when v_done then 'done' else 'ready' end;

    else
      continue;
    end case;

    -- A schedule shorter than its goals, or a zero in it, would fail the
    -- `reward_votes > 0` check at the insert and turn the claim into a 500
    -- for everyone on that step. Such a task is hidden until the row is fixed.
    if reward is null or reward <= 0 then continue; end if;

    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claiming
-- ---------------------------------------------------------------------------
create function public.claim_task(p_user_id uuid, p_task_id bigint, p_facts jsonb default '{}'::jsonb)
returns table (claimed boolean, granted bigint, referral_granted bigint, balance_after bigint)
language plpgsql
set search_path = ''
as $$
declare
  v_row  record;
  v_type text;
begin
  select * into v_row from public.task_progress(p_user_id, p_facts, p_task_id) p;

  if v_row.task_id is null or v_row.state <> 'ready' then
    return query
      select false, 0::bigint, 0::bigint, u.vote_balance from public.users u where u.id = p_user_id;
    return;
  end if;

  select t.type into v_type from public.tasks t where t.id = p_task_id;

  return query
    select r.granted > 0, r.granted, r.referral_granted, r.balance_after
      from public.apply_task_completion(
        p_user_id, v_type, null, p_task_id, v_row.claim_period, v_row.claim_step, v_row.reward
      ) r;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_task_completion: a period, a step and a reward from the claim
-- ---------------------------------------------------------------------------
--
-- Two more changes ride along.
--
-- The referral bonus now waits for a first ACTION — a visit, a subscription,
-- a boost. With a daily bonus that anyone collects on opening the app, «first
-- completed task» would again mean «opened the app», which is exactly what
-- the referral rule refused to pay for (01 Механики).
--
-- And the friend-streak bonus: when an invited friend's daily streak reaches
-- the `referral_streak` threshold, the inviter is paid once for that friend —
-- provided the friend has also done a first action. A week of opening the app
-- alone is still «opened the app», only seven times. Both user rows are
-- already locked here for the referral bonus.
drop function public.apply_task_completion(uuid, text, bigint, bigint);

create function public.apply_task_completion(
  p_user_id    uuid,
  p_task_type  text,
  p_project_id bigint default null,
  p_task_id    bigint default null,
  p_period     date   default null,
  p_step       int    default null,
  p_reward     bigint default null
)
returns table (granted bigint, referral_granted bigint, balance_after bigint)
language plpgsql
set search_path = ''
as $$
declare
  v_task        public.tasks;
  v_ref_task    public.tasks;
  v_period      date;
  v_reward      bigint;
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

  v_period := case when v_task.type = 'visit' then current_date else p_period end;
  v_reward := coalesce(p_reward, v_task.reward_votes);

  select u.referrer_id into v_referrer from public.users u where u.id = p_user_id;

  -- Обе строки users одним statement'ом, по возрастанию id, до первого UPDATE —
  -- тот же порядок блокировок, что у apply_payment по projects. Реферер читается
  -- до блокировки намеренно: `users.referrer_id` проставляется один раз при
  -- регистрации и дальше не меняется, гонки на нём нет.
  perform 1 from public.users
   where id = p_user_id or id = v_referrer
   order by id
   for update;

  -- Суточный предел переходов — строго за блокировкой: до неё параллельные
  -- вызовы читали ноль каждый и проходили все разом.
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

  insert into public.task_completions
    (task_id, user_id, project_id, period_day, step, reward_votes, status, completed_at)
  values
    (v_task.id, p_user_id, p_project_id, v_period, p_step, v_reward, 'completed', now())
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
     set vote_balance = vote_balance + v_reward
   where id = p_user_id
   returning vote_balance into v_balance;

  -- The inviter is paid for the friend's FIRST action. Counted after the
  -- insert, so one means «this row is the first».
  if v_referrer is not null and v_task.type in ('visit', 'subscribe', 'boost') then
    select count(*) = 1 into v_first
      from public.task_completions tc
      join public.tasks t on t.id = tc.task_id
     where tc.user_id = p_user_id
       and tc.status = 'completed'
       and t.type in ('visit', 'subscribe', 'boost');

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

  -- The friend's streak reached the threshold: once per friend, by the key.
  if v_referrer is not null and v_task.type = 'daily_checkin' and exists (
    select 1
      from public.task_completions tc
      join public.tasks t on t.id = tc.task_id
     where tc.user_id = p_user_id
       and tc.status = 'completed'
       and t.type in ('visit', 'subscribe', 'boost')
  ) then
    select * into v_ref_task
      from public.tasks t
     where t.type = 'referral_streak' and t.is_active
     limit 1;

    if v_ref_task.id is not null
       and p_step >= coalesce((v_ref_task.params ->> 'streak')::int, 7) then
      insert into public.task_completions
        (task_id, user_id, referred_user_id, reward_votes, status, completed_at)
      values
        (v_ref_task.id, v_referrer, p_user_id, v_ref_task.reward_votes, 'completed', now())
      on conflict do nothing;

      if found then
        update public.users
           set vote_balance = vote_balance + v_ref_task.reward_votes
         where id = v_referrer;
        v_ref_granted := v_ref_granted + v_ref_task.reward_votes;
      end if;
    end if;
  end if;

  -- `balance_after` — баланс самого действующего. Доплата пригласившему падает
  -- на другую строку и другой экран; вписать её в это число значило бы солгать
  -- ровно так же, как лгало сложение на клиенте.
  return query select v_reward, v_ref_granted, v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- A click on a new paid project also scouts it
-- ---------------------------------------------------------------------------
create or replace function public.register_project_click(p_project_id bigint, p_user_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_type    text;
  v_owner   uuid;
  v_created timestamptz;
  v_window  int;
begin
  select p.type, p.user_id, p.created_at into v_type, v_owner, v_created
    from public.projects p
   where p.id = p_project_id and p.status = 'active';

  if not found or v_owner = p_user_id then
    return false;
  end if;

  insert into public.project_clicks (project_id, user_id, day)
  values (p_project_id, p_user_id, current_date)
  on conflict do nothing;

  if not found then
    return false;
  end if;

  update public.projects set clicks = clicks + 1 where id = p_project_id;

  if v_type = 'paid' then
    perform public.apply_task_completion(p_user_id, 'visit', p_project_id);

    select coalesce((t.params ->> 'window_hours')::int, 24) into v_window
      from public.tasks t where t.type = 'daily_scout' and t.is_active limit 1;

    if v_window is not null and v_created > now() - make_interval(hours => v_window) then
      perform public.apply_task_completion(p_user_id, 'daily_scout', p_project_id);
    end if;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The «friend reached the first task» message is about `referral` only
-- ---------------------------------------------------------------------------
--
-- The trigger fires on every row with `referred_user_id`, and a friend-streak
-- bonus is such a row too: without this it would arrive as «your friend
-- finished their first task» a second time.
create or replace function public.notify_referral()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.type = 'referral'
  ) then
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- RPC surface: Edge Functions under service_role only
-- ---------------------------------------------------------------------------
revoke execute on function public.apply_task_completion(uuid, text, bigint, bigint, date, int, bigint)
  from public, anon, authenticated;
revoke execute on function public.task_progress(uuid, jsonb, bigint) from public, anon, authenticated;
revoke execute on function public.claim_task(uuid, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.ladder_next_goal(jsonb, int) from public, anon, authenticated;
revoke execute on function public.ladder_reward(jsonb, int) from public, anon, authenticated;

grant execute on function public.apply_task_completion(uuid, text, bigint, bigint, date, int, bigint)
  to service_role;
grant execute on function public.task_progress(uuid, jsonb, bigint) to service_role;
grant execute on function public.claim_task(uuid, bigint, jsonb) to service_role;
grant execute on function public.ladder_next_goal(jsonb, int) to service_role;
grant execute on function public.ladder_reward(jsonb, int) to service_role;
