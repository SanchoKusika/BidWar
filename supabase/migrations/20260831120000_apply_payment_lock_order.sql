-- Находка I7 финального ревью среза 1.5 (final-findings.md). Полностью
-- заменяет тело apply_payment из 20260830150000_apply_payment_locks.sql;
-- сигнатура и returns table не меняются, create or replace не трогает
-- существующие grant/revoke и comment.
--
-- Правило «блокировать строки projects по возрастанию id» держит отсутствие
-- дедлока во встречных операциях (Attack, срез 1.6), но раньше оно
-- соблюдалось ПОСТАТЕЙНО, а не в целом: первая блокировка функции брала
-- {project, leader_before}, вторая (пересчёт rank1_since) — отдельным
-- statement'ом {текущие держатели rank1_since, leader_after}. Каждая по
-- отдельности отсортирована, но их объединение — нет: если leader_after не
-- входит в первый набор (payment_amount может расти неравномерно между
-- проектами), вторая блокировка вправе запросить id МЕНЬШЕ, чем уже держит
-- транзакция. Раскладка из отчёта ревью: rank1_since на строке 29, реальный
-- максимум paid_amount — на 27 (после будущего Attack, который умеет
-- уменьшать paid_amount). T1 берёт 27, ждёт 29; T2 берёт 29, хочет 27—
-- дедлок. В самом срезе 1.5 недостижимо (paid_amount только растёт, поэтому
-- leader_after ∈ {project, leader_before}), но правило вводилось именно
-- «сразу, под 1.6» — и должно держаться уже сейчас, а не только в частных
-- случаях 1.5.
--
-- Правка: вместо двух отдельных FOR UPDATE — один, в начале функции, ДО
-- любых изменений. Набор строк — объединение всего, что могут тронуть оба
-- следующих шага: свой проект платежа, все текущие держатели rank1_since
-- (обычно один, но берём все — дешёво и не завязано на предположение об
-- уникальности) и текущий лидер по paid_amount (кандидат в leader_after).
-- В 1.5 этот набор гарантированно накрывает leader_after при любом исходе
-- (доказательство то же, что и раньше — paid_amount только растёт), а
-- поскольку блокировка теперь ровно одна и сортируется одним ORDER BY id,
-- проблема «объединение двух отсортированных наборов не отсортировано»
-- снимается структурно, а не за счёт инварианта, который перестанет
-- держаться в 1.6.
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
  v_leader_after  bigint;
  v_group         uuid := gen_random_uuid();
begin
  select * into v_payment from payment_transactions where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id;
  end if;

  -- Идемпотентность: платёж уже разобран, повтор ничего не меняет. Второй
  -- рубеж — unique (provider, provider_event_id) на случай гонки между ДВУМЯ
  -- разными платежами с одинаковым event_id.
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
      when unique_violation then
        update payment_transactions set status = 'failed' where id = p_payment_id;
    end;
    return query select false, v_payment.project_id, 0::bigint;
    return;
  end if;

  -- Единая блокировка всех строк projects, которые эта функция может
  -- тронуть на любом из двух шагов ниже (начисление и пересчёт
  -- rank1_since) — одним statement'ом, одним ORDER BY id, до первого UPDATE.
  perform 1 from projects
   where id = v_payment.project_id
      or (type = 'paid' and rank1_since is not null)
      or id = (
        select p.id from projects p
         where p.type = 'paid' and p.status = 'active'
         order by p.paid_amount desc, p.id asc
         limit 1
      )
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
    --     на payment_transactions.
    -- Локи на payment_transactions и на весь набор projects взяты раньше,
    -- вне этого блока, и откатом до SAVEPOINT не снимаются — пометить платёж
    -- failed после отката можно безопасно, без повторного FOR UPDATE.
    when unique_violation then
      update payment_transactions set status = 'failed' where id = p_payment_id;
      return query select false, v_payment.project_id, 0::bigint;
      return;
  end;

  -- rank1_since: лидер топа мог смениться. Лидер категории сюда не входит —
  -- его считает на лету вьюха category_stats. Набор строк, которые эти два
  -- UPDATE ниже тронут (текущие держатели rank1_since ∪ v_leader_after), уже
  -- заблокирован единой блокировкой выше — второй FOR UPDATE здесь больше не
  -- нужен.
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
