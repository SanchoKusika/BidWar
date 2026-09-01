-- Срез 1.6: Attack.
--
-- Attack — не перевод денег между пользователями, а покупка эффекта у
-- площадки (01 Механики): атакующий платит площадке ровно как за Raise, ставка
-- цели падает на сумму атаки, своя растёт на её часть после хейрката. Поэтому
-- Attack живёт ВНУТРИ apply_payment, а не рядом с ней: это единственное место,
-- двигающее деньги и очки, и оно обязано таким остаться. Вторая функция,
-- берущая те же строки projects, — это второй порядок блокировок, то есть
-- дедлок (08 План, обязательный пункт среза 1.6).
--
-- ## Что изменилось в блокировке
--
-- Раньше единый FOR UPDATE накрывал {проект платежа, держатели rank1_since,
-- текущий лидер}. Доказательство его достаточности опиралось на инвариант
-- «paid_amount только растёт» — ровно тот, который Attack и отменяет.
--
-- Теперь набор строк — {проект платежа, цель атаки, держатели rank1_since,
-- ТОП-2 платного топа}. Почему top-2, а не top-1:
--
--   Атака меняет ровно две строки: цель падает, атакующий растёт. Если цель
--   была первой и упала, новым лидером становится max(старый второй,
--   атакующий) — старый второй в прежний набор не входил, а следующим шагом
--   функция пишет ему rank1_since. Взять его лок ПОСЛЕ уже взятых — значит
--   нарушить возрастание id, ради которого всё и затевалось.
--
--   Третий сверху не нужен: чтобы лидером стал он, должны были упасть оба
--   верхних, а уменьшает paid_amount только Attack и только одну строку за
--   транзакцию.
--
-- Отсюда же следует, что пересчёт лидера после наших UPDATE не увидит чужого
-- изменения: любая транзакция, способная вытолкнуть наверх строку вне набора,
-- сама обязана взять лок на top-1 или top-2 (она тоже идёт через
-- apply_payment) — а их держим мы, и она ждёт нашего коммита.
--
-- ## Что изменилось в контракте
--
-- Добавлены две колонки в returns table, поэтому drop + create, а не
-- create or replace:
--   credited_points — сколько долетело до ставки атакующего после хейрката
--                     (для raise совпадает с points_granted);
--   reason          — почему платёж не применён. Раньше applied = false
--                     возвращалось по пяти разным причинам без единого
--                     способа их различить, и вызывающий не мог сказать
--                     человеку, что именно случилось.

drop function if exists apply_payment(uuid, text, boolean);

create function apply_payment(
  p_payment_id        uuid,
  p_provider_event_id text,
  p_confirmed         boolean
)
returns table (
  applied         boolean,
  project_id      bigint,
  points_granted  bigint,
  credited_points bigint,
  reason          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment        payment_transactions%rowtype;
  v_own            projects%rowtype;
  v_target         projects%rowtype;
  v_limits         jsonb;
  v_min_paid       bigint;
  v_min_attack     bigint;
  v_floor_pct      int;
  v_haircut_floor  int;    -- в базисных пунктах
  v_haircut_step   int;    -- в базисных пунктах
  v_reset_hours    int;
  v_max_per_target int;
  v_max_total      int;
  v_floor          bigint;
  v_room           bigint;
  v_hits_target    int;
  v_hits_total     int;
  v_prior          int;
  v_bp             int;
  v_credited       bigint := 0;
  v_reject         text;
  v_leader_after   bigint;
  v_group          uuid := gen_random_uuid();
begin
  select * into v_payment from payment_transactions where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id;
  end if;

  -- Идемпотентность: платёж уже разобран, повтор ничего не меняет. Второй
  -- рубеж — unique (provider, provider_event_id) на случай гонки между ДВУМЯ
  -- разными платежами с одинаковым event_id.
  if v_payment.status <> 'pending' then
    return query select false, v_payment.project_id, 0::bigint, 0::bigint, 'already_settled'::text;
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
    return query select false, v_payment.project_id, 0::bigint, 0::bigint, 'provider_declined'::text;
    return;
  end if;

  -- Единая блокировка всех строк projects, которые функция может тронуть на
  -- любом шаге ниже — одним statement'ом, одним ORDER BY id, до первого
  -- UPDATE. Обоснование набора — в шапке миграции. `id = target_project_id`
  -- null-безопасно: у raise цели нет, сравнение даёт null и строку не берёт.
  perform 1 from projects
   where id = v_payment.project_id
      or id = v_payment.target_project_id
      or (type = 'paid' and rank1_since is not null)
      or id in (
        select p.id from projects p
         where p.type = 'paid' and p.status = 'active'
         order by p.paid_amount desc, p.id asc
         limit 2
      )
   order by id
   for update;

  if v_payment.intent = 'raise' then
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
        return query select false, v_payment.project_id, 0::bigint, 0::bigint, 'slot_taken'::text;
        return;
    end;

    v_credited := v_payment.points_granted;

  else
    -- ------------------------------------------------------------------
    -- Attack. Третья, последняя проверка условий (04 Платежи и валюты):
    -- первая — create-payment, вторая — pre_checkout_query у настоящего
    -- провайдера (срез 1.10). К этому моменту между инвойсом и подтверждением
    -- могло измениться всё: ставка цели, лимиты, статусы обоих проектов.
    -- ------------------------------------------------------------------
    select value into v_limits from app_config where key = 'paid_limits';
    if v_limits is null then
      raise exception 'app_config.paid_limits не найден';
    end if;

    v_min_paid       := (v_limits->>'min_paid_amount')::bigint;
    v_min_attack     := (v_limits->>'min_attack_amount')::bigint;
    v_floor_pct      := (v_limits->>'attack_floor_pct_of_initial')::int;
    v_haircut_floor  := (v_limits->>'attack_haircut_floor_pct')::int * 100;
    v_haircut_step   := (v_limits->>'attack_haircut_step_pct')::int * 100;
    v_reset_hours    := (v_limits->>'attack_haircut_reset_hours')::int;
    v_max_per_target := (v_limits->>'max_attacks_per_target_per_day')::int;
    v_max_total      := (v_limits->>'max_attacks_total_per_day')::int;

    -- Пропущенный ключ дал бы null и дальше тихо посчитал бы атаку по нулевым
    -- лимитам. Молчаливого дефолта здесь быть не должно — это баланс игры.
    if v_min_paid is null or v_min_attack is null or v_floor_pct is null
       or v_haircut_floor is null or v_haircut_step is null or v_reset_hours is null
       or v_max_per_target is null or v_max_total is null then
      raise exception 'app_config.paid_limits неполон: в нём нет одного из ключей атаки';
    end if;

    select * into v_own    from projects where id = v_payment.project_id;
    select * into v_target from projects where id = v_payment.target_project_id;

    -- Окна лимитов скользящие, а не календарные: полночь иначе выдаёт двойную
    -- пачку атак на стыке суток (01 Механики).
    select count(*) into v_hits_target
      from stake_transactions
     where actor_user_id = v_payment.user_id
       and target_project_id = v_target.id
       and type = 'attack_out'
       and created_at > now() - interval '24 hours';

    select count(*) into v_hits_total
      from stake_transactions
     where actor_user_id = v_payment.user_id
       and type = 'attack_out'
       and created_at > now() - interval '24 hours';

    -- Пол цели: max(минимум топа, доля от ПЕРВОЙ ставки). Пустой initial_stake
    -- (строки старше backfill-миграции) считаем от текущей — это строже, и
    -- ошибка играет в пользу жертвы. Деление bigint усекает, как и BigInt в
    -- _shared/attack.ts: предпросмотр обязан сходиться с фактом до единицы.
    v_floor := greatest(
      v_min_paid,
      (coalesce(v_target.initial_stake, v_target.paid_amount) * v_floor_pct) / 100
    );
    v_room := greatest(0, v_target.paid_amount - v_floor);

    -- Обе строки гарантированы внешними ключами payment_transactions, но
    -- пустой rowtype молча превратил бы все сравнения ниже в null и пропустил
    -- атаку без единой проверки. Явный отказ дешевле такого исхода.
    if v_own.id is null or v_target.id is null then
      v_reject := 'project_missing';
    elsif v_own.type <> 'paid' or v_own.status <> 'active' then
      v_reject := 'attacker_inactive';
    elsif v_target.type <> 'paid' then
      -- Attack работает только по paid_amount и никогда не трогает votes.
      v_reject := 'target_not_paid';
    elsif v_target.status <> 'active' then
      v_reject := 'target_inactive';
    elsif v_target.user_id = v_payment.user_id then
      v_reject := 'self_attack';
    elsif v_hits_target >= v_max_per_target then
      v_reject := 'target_limit';
    elsif v_hits_total >= v_max_total then
      v_reject := 'day_limit';
    elsif v_payment.points_granted < v_min_attack then
      v_reject := 'below_min';
    elsif v_payment.points_granted > v_room then
      -- Цель успела упасть ниже, чем была при выставлении инвойса. Списать
      -- полную сумму и применить частичный эффект нельзя (01 Механики), а
      -- урезать уже выставленный инвойс поздно — отказ целиком.
      v_reject := 'does_not_fit';
    end if;

    if v_reject is not null then
      update payment_transactions set status = 'failed' where id = p_payment_id;
      return query select false, v_payment.project_id, 0::bigint, 0::bigint, v_reject;
      return;
    end if;

    -- Коэффициент считается по СВОЕМУ окну (attack_haircut_reset_hours), а не
    -- по суточному окну лимитов: это разные правила с разными окнами, и
    -- считать их одним счётчиком — ошибка, которая тихо занижает зачисление.
    select count(*) into v_prior
      from stake_transactions
     where actor_user_id = v_payment.user_id
       and target_project_id = v_target.id
       and type = 'attack_out'
       and created_at > now() - make_interval(hours => v_reset_hours);

    v_bp := greatest(v_haircut_floor, 10000 - v_haircut_step * v_prior);
    v_credited := (v_payment.points_granted * v_bp) / 10000;

    begin
      update projects
         set paid_amount = paid_amount - v_payment.points_granted,
             updated_at  = now()
       where id = v_target.id;

      update projects
         set paid_amount = paid_amount + v_credited,
             updated_at  = now()
       where id = v_own.id;

      -- Две записи одной атаки связаны transaction_group_id. attack_out висит
      -- на цели (её счётчик упал) и несёт target_project_id — по этой паре
      -- считается хейркат, под неё заведён stake_transactions_haircut_idx.
      insert into stake_transactions
        (transaction_group_id, payment_id, actor_user_id, project_id,
         target_project_id, amount, type)
      values
        (v_group, p_payment_id, v_payment.user_id, v_target.id,
         v_target.id, -v_payment.points_granted, 'attack_out');

      -- Хейркат может съесть зачисление до нуля, если пол коэффициента
      -- когда-нибудь опустят до 0: строки с amount = 0 запрещены знаковым
      -- constraint'ом, и писать её незачем — эффекта нет.
      if v_credited > 0 then
        insert into stake_transactions
          (transaction_group_id, payment_id, actor_user_id, project_id,
           target_project_id, amount, type, coefficient)
        values
          (v_group, p_payment_id, v_payment.user_id, v_own.id,
           v_target.id, v_credited, 'attack_in', v_bp::numeric / 10000);
      end if;

      update payment_transactions
         set status = 'confirmed',
             confirmed_at = now(),
             provider_event_id = coalesce(p_provider_event_id, provider_event_id)
       where id = p_payment_id;
    exception
      -- Здесь возможна ровно одна причина: чужой платёж только что записал тот
      -- же provider_event_id. Слот проекта у атаки не меняется, unique-индексы
      -- projects в этой ветке не участвуют.
      when unique_violation then
        update payment_transactions set status = 'failed' where id = p_payment_id;
        return query select false, v_payment.project_id, 0::bigint, 0::bigint, 'duplicate_event'::text;
        return;
    end;
  end if;

  -- rank1_since: лидер топа мог смениться — Raise поднимает свою строку,
  -- Attack роняет чужую. Лидер категории сюда не входит, его считает на лету
  -- вьюха category_stats. Все строки, которых касаются два UPDATE ниже, уже
  -- взяты единой блокировкой в начале функции.
  select p.id into v_leader_after
    from projects p
   where p.type = 'paid' and p.status = 'active'
   order by p.paid_amount desc, p.id asc
   limit 1;

  update projects set rank1_since = null
   where type = 'paid' and rank1_since is not null and id is distinct from v_leader_after;

  update projects set rank1_since = now()
   where id = v_leader_after and rank1_since is null;

  return query select true, v_payment.project_id, v_payment.points_granted, v_credited, null::text;
end;
$$;

comment on function apply_payment is
  'Применяет платёж (raise или attack) к счётчикам одной транзакцией. Идемпотентна: повторный вызов по тому же платежу — no-op';

revoke all on function apply_payment(uuid, text, boolean) from public, anon, authenticated;
grant execute on function apply_payment(uuid, text, boolean) to service_role;
