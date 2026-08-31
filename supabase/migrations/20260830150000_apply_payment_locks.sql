-- Правки ревью задачи 2 среза 1.5 (см. task-2-report.md, раздел «Правки по
-- находкам ревью»). Полностью заменяет тело apply_payment из
-- 20260830120000_payment_layer.sql; сигнатура и returns table не меняются,
-- поэтому create or replace не трогает существующие grant/revoke и comment.
--
-- Правка 1 (находка 2 отчёта): финальный update payment_transactions
-- (provider_event_id = coalesce(...)) не был защищён от unique_violation —
-- только промежуточный update projects. Теперь один exception-блок
-- накрывает весь путь начисления: update projects + insert stake_transactions
-- + финальный update payment_transactions. То же самое сделано и для
-- update в ветке отказа провайдера — там пишется тот же provider_event_id
-- той же самой гонкой.
--
-- Правка 2 (находка 3 отчёта): пересчёт rank1_since блокировал только две
-- заранее известные строки (проект платежа + лидер ДО операции), а трогал —
-- любую строку с непустым rank1_since. Теперь набор строк для пересчёта
-- блокируется отдельно, по возрастанию id, непосредственно перед update-ами.
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
  -- рубеж — unique (provider, provider_event_id) на случай гонки между ДВУМЯ
  -- разными платежами с одинаковым event_id; оба места ниже, где эта колонка
  -- пишется, теперь сами ловят unique_violation, а не роняют вызывающую
  -- транзакцию сырым исключением Postgres.
  if v_payment.status <> 'pending' then
    return query select false, v_payment.project_id, 0::bigint;
    return;
  end if;

  if not p_confirmed then
    begin
      update payment_transactions
         set status = 'failed',
             provider_event_id = coalesce(p_provider_event_id, provider_event_id)
       where id = p_payment_id;
    exception
      -- Тот же provider_event_id секундой раньше мог достаться другому
      -- отклонённому платежу. Решение «этот платёж — failed» не меняется,
      -- откатывается (SAVEPOINT блока) только попытка записать чужой event_id.
      when unique_violation then
        update payment_transactions set status = 'failed' where id = p_payment_id;
    end;
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
  exception
    -- Один рубеж на весь блок начисления, две независимые причины:
    --  а) адрес не резервируется за строкой в pending_payment — слот мог
    --     занять кто-то другой, пока шла оплата (unique на projects);
    --  б) тот же provider_event_id только что записал ЧУЖОЙ платёж — unique
    --     на payment_transactions, тот самый «второй рубеж» из комментария
    --     выше, который раньше защищал только update projects, а не себя.
    -- PL/pgSQL откатывает блок целиком к SAVEPOINT перед begin — уже
    -- поставленные paid_amount/initial_stake/stake_transactions отменяются
    -- при любой из двух причин, очки не начисляются никогда наполовину.
    -- Локи на payment_transactions и на обе строки projects взяты раньше,
    -- вне этого блока, и откатом до SAVEPOINT не снимаются — пометить платёж
    -- failed после отката можно безопасно, без повторного FOR UPDATE.
    when unique_violation then
      update payment_transactions set status = 'failed' where id = p_payment_id;
      return query select false, v_payment.project_id, 0::bigint;
      return;
  end;

  -- rank1_since: лидер топа мог смениться. Лидер категории сюда не входит —
  -- его считает на лету вьюха category_stats.
  select p.id into v_leader_after
    from projects p
   where p.type = 'paid' and p.status = 'active'
   order by p.paid_amount desc, p.id asc
   limit 1;

  -- Набор строк для пересчёта мог разойтись с тем, что заблокировано выше:
  -- пока эта транзакция ждала лок на v_leader_before, лидер мог смениться и
  -- закоммититься в другой транзакции — текущий держатель rank1_since тогда
  -- уже не та строка. Блокируем ровно то, что тронут два update ниже
  -- («текущий держатель rank1_since» ∪ «новый лидер»), тем же порядком по
  -- возрастанию id, что и самая первая блокировка функции: другой порядок
  -- здесь тоже даёт дедлок с встречными операциями (Attack, срез 1.6).
  perform 1 from projects
   where type = 'paid' and (rank1_since is not null or id = v_leader_after)
   order by id
   for update;

  update projects set rank1_since = null
   where type = 'paid' and rank1_since is not null and id is distinct from v_leader_after;

  update projects set rank1_since = now()
   where id = v_leader_after and rank1_since is null;

  return query select true, v_payment.project_id, v_payment.points_granted;
end;
$$;

comment on function apply_payment is
  'Применяет платёж к счётчикам одной транзакцией. Идемпотентна: повторный вызов по тому же платежу — no-op';
