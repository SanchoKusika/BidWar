-- Находка I8 финального ревью среза 1.5 (final-findings.md).
--
-- initial_stake — база для floor будущих атак (attack_floor_pct_of_initial,
-- app_config.paid_limits), фиксируется apply_payment по правилу
-- `coalesce(initial_stake, points_granted)` — то есть ПЕРВЫМ довзносом. У
-- сидовых платных проектов initial_stake всегда был NULL (сиды заводились
-- напрямую, до апрельского apply_payment), поэтому первый же Raise на такой
-- проект зафиксировал бы initial_stake равным одной этой прибавке, а не
-- всей уже набранной ставке — например Raise на 50 000 по проекту с уже
-- накопленными 605 000 дал бы initial_stake = 50 000, и floor (50%) в 1.6
-- позволил бы обвалить такой проект почти до нуля вместо честной половины
-- реальной ставки.
--
-- Бэкфилл: initial_stake = paid_amount для активных платных строк, где он
-- ещё NULL и paid_amount > 0 (paid_amount = 0 быть не должно у активных
-- платных строк — но фильтр буквально по правилу находки, а не по
-- предположению о данных). Проекты в pending_payment/hidden/blocked не
-- трогаем: их initial_stake зафиксирует первый confirmed-платёж штатно,
-- через ту же самую формулу в apply_payment.
update projects
   set initial_stake = paid_amount
 where type = 'paid'
   and status = 'active'
   and initial_stake is null
   and paid_amount > 0;
