-- Срез 1.5. Проект живёт в pending_payment между созданием инвойса и его
-- подтверждением: строку нельзя завести после оплаты, потому что
-- payment_transactions.project_id объявлен not null. Все витрины, RLS и
-- уникальные индексы фильтруют по status = 'active', поэтому такой строки для
-- них не существует.
alter table projects drop constraint projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('active', 'pending_payment', 'hidden', 'blocked'));

alter table payment_transactions drop constraint payment_transactions_provider_check;
alter table payment_transactions add constraint payment_transactions_provider_check
  check (provider in ('mock', 'globalpay', 'platega', 'paddle', 'telegram_stars'));

-- Единственное место, которое двигает деньги и очки. В базе, а не в Edge
-- Function: supabase-js не умеет многооператорных транзакций, а здесь
-- обязательны FOR UPDATE и атомарность (02 Архитектура).
create or replace function apply_payment(
  p_payment_id        uuid,
  p_provider_event_id text,
  p_confirmed         boolean
)
returns table (applied boolean, project_id bigint, points_granted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment       payment_transactions%rowtype;
  v_leader_before bigint;
  v_leader_after  bigint;
  v_group         uuid := gen_random_uuid();
begin
  select * into v_payment from payment_transactions where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id;
  end if;

  -- Идемпотентность: платёж уже разобран, повтор ничего не меняет. Второй
  -- рубеж — unique (provider, provider_event_id) на случай гонки.
  if v_payment.status <> 'pending' then
    return query select false, v_payment.project_id, 0::bigint;
    return;
  end if;

  if not p_confirmed then
    update payment_transactions
       set status = 'failed',
           provider_event_id = coalesce(p_provider_event_id, provider_event_id)
     where id = p_payment_id;
    return query select false, v_payment.project_id, 0::bigint;
    return;
  end if;

  select p.id into v_leader_before
    from projects p
   where p.type = 'paid' and p.status = 'active' and p.rank1_since is not null
   limit 1;

  -- Блокировка по возрастанию id обязательна: во встречных операциях (Attack,
  -- срез 1.6) любой другой порядок даёт дедлок.
  perform 1 from projects
   where id in (v_payment.project_id, coalesce(v_leader_before, v_payment.project_id))
   order by id
   for update;

  begin
    update projects
       set paid_amount   = paid_amount + v_payment.points_granted,
           initial_stake = coalesce(initial_stake, v_payment.points_granted),
           status        = case when status = 'pending_payment' then 'active' else status end,
           updated_at    = now()
     where id = v_payment.project_id;
  exception
    -- Адрес не резервируется за строкой в pending_payment, поэтому слот мог
    -- занять кто-то другой, пока шла оплата. Очки не начисляем; для реального
    -- провайдера это случай возврата — срез 1.10.
    when unique_violation then
      update payment_transactions set status = 'failed' where id = p_payment_id;
      return query select false, v_payment.project_id, 0::bigint;
      return;
  end;

  insert into stake_transactions
    (transaction_group_id, payment_id, actor_user_id, project_id, amount, type)
  values
    (v_group, p_payment_id, v_payment.user_id, v_payment.project_id,
     v_payment.points_granted, 'raise');

  update payment_transactions
     set status = 'confirmed',
         confirmed_at = now(),
         provider_event_id = coalesce(p_provider_event_id, provider_event_id)
   where id = p_payment_id;

  -- rank1_since: лидер топа мог смениться. Лидер категории сюда не входит —
  -- его считает на лету вьюха category_stats.
  select p.id into v_leader_after
    from projects p
   where p.type = 'paid' and p.status = 'active'
   order by p.paid_amount desc, p.id asc
   limit 1;

  update projects set rank1_since = null
   where type = 'paid' and rank1_since is not null and id is distinct from v_leader_after;

  update projects set rank1_since = now()
   where id = v_leader_after and rank1_since is null;

  return query select true, v_payment.project_id, v_payment.points_granted;
end;
$$;

comment on function apply_payment is
  'Применяет платёж к счётчикам одной транзакцией. Идемпотентна: повторный вызов по тому же платежу — no-op';

revoke all on function apply_payment(uuid, text, boolean) from public, anon, authenticated;
grant execute on function apply_payment(uuid, text, boolean) to service_role;
