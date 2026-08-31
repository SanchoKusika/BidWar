-- Находка C2 финального ревью среза 1.5 (final-findings.md).
--
-- create-payment переиспользует брошенную строку pending_payment того же
-- пользователя и типа (проектное решение «Брошенные оплаты» из спеки
-- 2026-08-30-payment-layer-raise-design.md), обновляя в т.ч. category_id.
-- Триггер projects_identity_is_immutable (миграция 20260827150005) был
-- заведён для АКТИВНЫХ проектов — «нельзя задним числом перевести проект в
-- чужую витрину» — но буквально написан как «category_id/type неизменяемы
-- после создания СТРОКИ», а строка создаётся уже в статусе pending_payment,
-- до какой-либо публичности. Итог: платёж отклонён → пользователь пробует
-- снова с другой категорией → check_violation → 500, слот навсегда занят
-- брошенной строкой, которую нельзя ни обновить (триггер), ни удалить
-- (payment_transactions.project_id ссылается), ни вставить новую поверх
-- (projects_one_pending_per_user_and_type_idx).
--
-- Правка: пока OLD.status = 'pending_payment', строка ещё не была активной
-- ни разу — ни одна витрина, RLS-политика или уникальный индекс активных
-- записей её не видит, значит и «переводить в чужую категорию задним
-- числом» ещё нечего. Как только status становится 'active' (внутри
-- apply_payment, тем же UPDATE, что поднимает paid_amount), immutability
-- полностью вступает в силу для всех последующих обновлений.
create or replace function forbid_project_identity_change() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if old.status = 'pending_payment' then
    return new;
  end if;

  if new.type is distinct from old.type then
    raise exception 'projects.type неизменяем после создания (% -> %)', old.type, new.type
      using errcode = 'check_violation';
  end if;
  if new.category_id is distinct from old.category_id then
    raise exception 'projects.category_id неизменяем после создания (% -> %)', old.category_id, new.category_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
