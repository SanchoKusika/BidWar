-- Правка ревью задачи 4 среза 1.5 (task-4-report.md, находка 3): открывающий
-- платёж заводит строку projects со status = 'pending_payment' до подтверждения
-- оплаты. projects_one_active_per_user_and_type_idx ограничен
-- `where status = 'active'` и на pending_payment не действует — два
-- одновременных открывающих запроса одного пользователя оба проходили
-- проверку «активного слота нет» и оба вставляли строку. Инвариант «не больше
-- одной pending_payment-строки на пользователя», на который опирается
-- create-payment (комментарий «Брошенные оплаты не копятся»), обеспечиваем
-- на уровне БД, а не проверкой в коде — тем же принципом, что и остальные
-- unique-индексы projects (02 Архитектура, «Constraints уровня БД вместо
-- надежды, что клиент не смухлюет»).
create unique index projects_one_pending_per_user_and_type_idx
  on projects (user_id, type) where status = 'pending_payment';
