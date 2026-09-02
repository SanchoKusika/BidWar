-- Две вьюхи поверх stake_transactions: лента событий и суточный борд.
--
-- Почему вьюхи, а не чтение таблицы через RLS. У `stake_transactions` нет
-- политики на чтение и не должно быть: в строке лежит `actor_user_id`, то есть
-- «кто ударил» — а публично известно только «по кому ударили». Вьюха без
-- security_invoker выполняется правами владельца и потому проходит мимо RLS
-- базовой таблицы, отдавая наружу ровно перечисленные колонки. Автора в них
-- нет вовсе — не «скрыт фронтом», а не выбран запросом.
--
-- Обе смотрят только на активные проекты: скрытая запись ушла из витрины, и её
-- события в ленте были бы ссылкой в никуда.

-- ---------------------------------------------------------------------------
-- Лента «Just happened» на витрине и «Bid activity» на странице проекта.
-- ---------------------------------------------------------------------------
--
-- Одна атака пишет в леджер две связанные строки: attack_out на цели (её
-- ставка упала) и attack_in на атакующем (его выросла на часть суммы). Обе
-- здесь есть, и это осознанно: в общей ленте нужна первая («по кому ударили»),
-- на странице проекта — обе, потому что для атакующего его собственный рост
-- это тоже событие его ставки. Фильтрует вызывающий, а не вьюха.
create or replace view stake_activity as
select
  st.id,
  st.project_id,
  p.name as project_name,
  p.type as project_type,
  st.target_project_id,
  t.name as target_name,
  st.type,
  -- attack_out лежит со знаком минус (это потеря): наружу отдаём модуль, знак
  -- несёт сам тип события — иначе клиенту пришлось бы знать про знаковый
  -- леджер, чтобы просто нарисовать строку.
  abs(st.amount) as amount,
  st.created_at
from stake_transactions st
join projects p on p.id = st.project_id and p.status = 'active'
left join projects t on t.id = st.target_project_id
order by st.created_at desc;

grant select on stake_activity to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Платный топ за скользящие сутки — переключатель «Today» в шапке витрины.
-- ---------------------------------------------------------------------------
--
-- Окно скользящее, а не календарное, по той же причине, что у лимитов атак
-- (01 Механики): полночь иначе делает разрыв на ровном месте.
--
-- today_amount — ЧИСТОЕ движение ставки за сутки: сумма со знаком, поэтому
-- полученная атака его уменьшает. Читающий берёт только положительные
-- (`today_amount > 0`): «Today» отвечает на вопрос «кто вырос за сутки», и
-- строка с отрицательным движением в таком списке была бы бессмыслицей.
--
-- Колонки повторяют выборку витрины (entities/project/api.ts) — карточка
-- рисуется тем же кодом, меняется только число, по которому она отсортирована.
create or replace view paid_today_top as
select
  p.id,
  p.user_id,
  p.category_id,
  p.type,
  p.name,
  p.url,
  p.og_image_url,
  p.og_description,
  p.paid_amount,
  p.votes,
  p.clicks,
  p.rank1_since,
  coalesce(sum(st.amount), 0)::bigint as today_amount
from projects p
join stake_transactions st
  on st.project_id = p.id
 and st.created_at > now() - interval '24 hours'
where p.type = 'paid' and p.status = 'active'
group by p.id;

grant select on paid_today_top to anon, authenticated;
