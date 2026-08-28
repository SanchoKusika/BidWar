-- app_config хранит только публичные настройки (лимиты ставок, курсы, награды
-- за задания) — ничего платёжного или личного. Фронту нужен min_paid_amount
-- (подсказка "цена этой позиции" на карточках, дальше — валидация Raise),
-- поэтому открываем читать целиком, как categories/projects/tasks.
grant select on app_config to anon, authenticated;

create policy app_config_read_all on app_config
  for select to anon, authenticated using (true);
