-- Новая категория «Profiles» — личные аккаунты (Telegram, Instagram,
-- LinkedIn и т.д.), а не каналы/боты/сайты/бизнес/сервисы. Список категорий
-- фиксирован платформой (01 Механики.md: «пользователи их не создают») —
-- добавление новой строки требует миграции, а не действия пользователя.
--
-- sort_order = 6 — после уже существующих пяти (channels..services), чтобы
-- не переставлять порядок остальных.
insert into categories (slug, title, sort_order) values
  ('profiles', 'Profiles', 6)
on conflict (slug) do nothing;
