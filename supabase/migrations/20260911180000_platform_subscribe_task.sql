-- Задание «подписаться на канал площадки».
--
-- До этого `subscribe` существовал только как задание ПРОЕКТА: строка
-- появлялась сама, когда владелец канала-проекта давал боту права
-- (`apply_channel_admin`), и чат брался из `projects.tg_chat_id`. В этом вся
-- смычка двух экономик — платящий получает подписчиков, бесплатный топ получает
-- голоса.
--
-- Наш собственный канал в эту схему не ложится: за него никто не платил, и
-- заводить его проектом означало бы поставить площадку участником в свой же
-- список — ровно то, что страница «О BidWar» обещает не делать никогда.
-- Поэтому у задания появляется собственная цель: чат и ссылка прямо в строке
-- `tasks`, без проекта. Это и есть «задания — собственный список площадки»
-- ([[01 Механики]]), как `visit` и `referral`.
alter table tasks
  add column target_chat_id bigint,
  add column target_url     text;

comment on column tasks.target_chat_id is
  'Чат задания площадки; у заданий проекта пусто — там чат берётся из projects';
comment on column tasks.target_url is
  'Ссылка задания площадки; у заданий проекта пусто — там ссылка берётся из projects';

-- Подписываться всегда есть на что: либо проект, либо свой канал. Строка
-- `subscribe` без цели непроверяема, и лучше не дать её создать, чем потом
-- гадать, почему «Проверить» ничего не делает.
alter table tasks
  add constraint tasks_subscribe_has_target
  check (type <> 'subscribe' or target_project_id is not null or target_chat_id is not null);

-- Сам канал: @BidWar_world (BidWar News). chat_id получен у Bot API и записан
-- числом, а не юзернеймом: юзернейм владелец может сменить, id — нет.
--
-- Награда берётся из того же `app_config.task_rewards`, что и у подписки на
-- канал проекта: платформенное задание не может стоить дороже обычного, иначе
-- это уже не задание, а реклама за голоса.
insert into tasks (type, title, description, reward_votes, target_chat_id, target_url)
select
  'subscribe',
  'Subscribe to @BidWar_world',
  'Stay subscribed to keep the votes.',
  coalesce((select (value ->> 'subscribe')::bigint from app_config where key = 'task_rewards'), 2),
  -1003948577309,
  'https://t.me/BidWar_world'
where not exists (
  select 1 from tasks where type = 'subscribe' and target_chat_id = -1003948577309
);
