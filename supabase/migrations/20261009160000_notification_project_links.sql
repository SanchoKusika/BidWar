-- Messages name the project that moved you, not only its owner, and link it.
--
-- Until now the bot wrote the owner's Telegram handle: «@someone took the
-- spot». When the winner is a website, the person reading wants the site —
-- «Google», linked to google.com — not a stranger's username. The triggers
-- now also pass the project's name and link; notify_text.ts decides how to
-- print them (a t.me link becomes @username, anything else a hyperlink on
-- the name). The handle stays in the payload as the fallback.
--
-- Both functions are the 20260911160000 versions with those fields added.

create or replace function notify_attacked()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target      public.projects;
  v_attacker    text;
  v_attacker_project public.projects;
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
  select * into v_attacker_project from public.projects p where p.id = new.project_id;

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
      'attacker_project', v_attacker_project.name,
      'attacker_url',     v_attacker_project.url,
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

create or replace function notify_rank_lost()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_winner_user  uuid;
  v_winner_name  text;
  v_winner_url   text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select p.user_id, p.name, p.url into v_winner_user, v_winner_name, v_winner_url
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
      'winner_project', v_winner_name,
      'winner_url',     v_winner_url
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;
