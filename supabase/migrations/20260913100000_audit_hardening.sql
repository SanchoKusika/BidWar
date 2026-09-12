-- Findings of the 13.09.2026 project audit.

-- ---------------------------------------------------------------------------
-- Clicks: only a live project counts, and never your own.
--
-- The visit task pays for clicks on paid projects. Without the status check a
-- click on a hidden, blocked or unpaid project still paid (ids are sequential,
-- so such projects are easy to find), and a click on your own project paid as
-- well. A project that does not exist used to fail on the foreign key with a
-- 500; now it is simply not counted.
-- ---------------------------------------------------------------------------
create or replace function public.register_project_click(p_project_id bigint, p_user_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_type  text;
  v_owner uuid;
begin
  select p.type, p.user_id into v_type, v_owner
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
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity: write only what changed.
--
-- Every Edge Function resolves the caller first, so this runs on each click,
-- vote and settings read. It used to update users and auth_identities every
-- time — a write and a row lock on users that cast_votes and
-- apply_task_completion then wait for. An UPDATE whose WHERE matches nothing
-- takes no row lock.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_telegram_identity(
  p_telegram_id text,
  p_display_name text,
  p_avatar_url text,
  p_meta jsonb,
  p_referrer_id uuid
)
returns table(
  user_id uuid,
  is_new boolean,
  display_name text,
  avatar_url text,
  vote_balance bigint,
  username text,
  joined_at timestamptz,
  invited_count bigint
)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_referrer_id uuid := p_referrer_id;
  v_is_new boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('telegram:' || p_telegram_id));

  if v_referrer_id is not null and not exists (
    select 1 from public.users u where u.id = v_referrer_id
  ) then
    v_referrer_id := null;
  end if;

  select ai.user_id into v_user_id
  from public.auth_identities ai
  where ai.provider = 'telegram' and ai.provider_uid = p_telegram_id;

  if v_user_id is null then
    insert into public.users (display_name, avatar_url, referrer_id)
    values (p_display_name, p_avatar_url, v_referrer_id)
    returning id into v_user_id;

    insert into public.auth_identities (user_id, provider, provider_uid, meta)
    values (v_user_id, 'telegram', p_telegram_id, p_meta);

    v_is_new := true;
  else
    update public.auth_identities
       set meta = p_meta
     where provider = 'telegram'
       and provider_uid = p_telegram_id
       and meta is distinct from p_meta;

    update public.users u
       set display_name = p_display_name,
           avatar_url = coalesce(p_avatar_url, u.avatar_url)
     where u.id = v_user_id
       and (
         u.display_name is distinct from p_display_name
         or (p_avatar_url is not null and u.avatar_url is distinct from p_avatar_url)
       );
  end if;

  return query
    select
      u.id,
      v_is_new,
      u.display_name,
      u.avatar_url,
      u.vote_balance,
      nullif(p_meta->>'username', ''),
      u.created_at,
      (select count(*) from public.users r where r.referrer_id = u.id)
    from public.users u
    where u.id = v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Spending totals in SQL.
--
-- my-spending summed the rows in the function, and the API returns at most
-- max_rows (1000) of them: past a thousand payments "paid in total" would
-- silently come out smaller than the truth.
-- ---------------------------------------------------------------------------
create or replace function public.spending_totals(p_user_id uuid)
returns table(total bigint, month bigint)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(pt.points_granted), 0)::bigint,
    coalesce(sum(pt.points_granted) filter (where pt.confirmed_at >= now() - interval '30 days'), 0)::bigint
  from public.payment_transactions pt
  where pt.user_id = p_user_id and pt.status = 'confirmed';
$$;

-- ---------------------------------------------------------------------------
-- Activity feed: a hidden or blocked target is not named.
--
-- The feed already hid events of inactive projects, but the target of an
-- attack was joined without a status check, so a removed project's name could
-- still show up as "who got hit".
-- ---------------------------------------------------------------------------
create or replace view public.stake_activity as
  select
    st.id,
    st.project_id,
    p.name as project_name,
    p.type as project_type,
    st.target_project_id,
    t.name as target_name,
    st.type,
    abs(st.amount) as amount,
    st.created_at
  from public.stake_transactions st
  join public.projects p on p.id = st.project_id and p.status = 'active'
  left join public.projects t on t.id = st.target_project_id and t.status = 'active'
  order by st.created_at desc;

-- ---------------------------------------------------------------------------
-- RPC surface.
--
-- Everything that moves votes or identities is called only by Edge Functions
-- under service_role. Migrations granted EXECUTE to service_role but never
-- revoked the default grant to PUBLIC, so anyone with the public anon key
-- could call these over the Data API. Today that fails only because they run
-- as invoker and anon cannot write the tables; one SECURITY DEFINER would have
-- turned the public key into a vote printer.
-- ---------------------------------------------------------------------------
revoke execute on function public.apply_channel_admin(bigint, text, boolean) from public, anon, authenticated;
revoke execute on function public.apply_task_completion(uuid, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.cast_votes(uuid, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.register_project_click(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.resolve_telegram_identity(text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.spending_totals(uuid) from public, anon, authenticated;

grant execute on function public.apply_channel_admin(bigint, text, boolean) to service_role;
grant execute on function public.apply_task_completion(uuid, text, bigint, bigint) to service_role;
grant execute on function public.cast_votes(uuid, bigint, bigint) to service_role;
grant execute on function public.register_project_click(bigint, uuid) to service_role;
grant execute on function public.resolve_telegram_identity(text, text, text, jsonb, uuid) to service_role;
grant execute on function public.spending_totals(uuid) to service_role;

-- And the default that caused it: a function created from now on is callable
-- by service_role only, until a migration grants more on purpose.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- The views are read-only by nature (joins and aggregates), but the default
-- table grants gave anon and authenticated write privileges on them. They run
-- with the owner's rights to hide who acted, so the first simple, updatable
-- view would have become a way around RLS.
revoke insert, update, delete, truncate, references, trigger
  on public.category_stats,
     public.stake_activity,
     public.paid_today_top,
     public.paid_movement_24h,
     public.vote_activity,
     public.free_today_top
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Foreign keys without an index (performance advisor). Attack limits and the
-- dev reset look stakes and payments up by target; tasks are looked up by id
-- when a task row is removed.
-- ---------------------------------------------------------------------------
create index if not exists stake_transactions_target_idx
  on public.stake_transactions (target_project_id);
create index if not exists payment_transactions_target_idx
  on public.payment_transactions (target_project_id);
create index if not exists task_completions_task_idx
  on public.task_completions (task_id);
