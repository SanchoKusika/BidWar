-- How much a person has put into each project's bid: their own raises and the
-- raises they made to someone else's project (01 Механики, «Raise чужого
-- проекта»). The project page shows it as «you put in», the profile can too.
--
-- Raises only: an attack's money lowers the target and is not a contribution
-- to it. Summed in SQL for the same reason as spending_totals — the API cuts
-- any row fetch at a thousand.
create function public.spending_by_project(p_user_id uuid)
returns table(project_id bigint, total bigint)
language sql
stable
set search_path = ''
as $$
  select pt.project_id, sum(pt.points_granted)::bigint
    from public.payment_transactions pt
   where pt.user_id = p_user_id
     and pt.status = 'confirmed'
     and pt.intent = 'raise'
   group by pt.project_id;
$$;

revoke all on function public.spending_by_project(uuid) from public, anon, authenticated;
grant execute on function public.spending_by_project(uuid) to service_role;

-- The «money paid» card counts too: how many payments, and how many of them
-- were attacks (ui_kits/web profile). Counted next to the sums, in SQL, for
-- the same thousand-row reason. A wider row means a new signature, so the
-- function is replaced rather than redefined in place.
drop function public.spending_totals(uuid);

create function public.spending_totals(p_user_id uuid)
returns table(total bigint, month bigint, payments bigint, attacks bigint)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(pt.points_granted), 0)::bigint,
    coalesce(sum(pt.points_granted) filter (where pt.confirmed_at >= now() - interval '30 days'), 0)::bigint,
    count(*)::bigint,
    count(*) filter (where pt.intent = 'attack')::bigint
  from public.payment_transactions pt
  where pt.user_id = p_user_id and pt.status = 'confirmed';
$$;

revoke all on function public.spending_totals(uuid) from public, anon, authenticated;
grant execute on function public.spending_totals(uuid) to service_role;
