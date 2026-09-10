-- Срез 1.7, окончание: subscribe-задания и суточный разрез бесплатного топа.

-- ---------------------------------------------------------------------------
-- Бот стал (или перестал быть) администратором канала
-- ---------------------------------------------------------------------------
--
-- `getChatMember` отвечает достоверно по ЧУЖОМУ пользователю только если бот —
-- администратор в этом чате; без прав он может вернуть `left` для реально
-- подписанного человека (06 Telegram-бот). Отсюда весь флоу: владелец канала
-- добавляет бота админом, и только после этого у его проекта появляется
-- subscribe-задание.
--
-- Одна хранимка на два входа — кнопку «Проверить» у владельца и апдейт
-- `my_chat_member`, который приходит сам, когда бота добавили или удалили.
-- Правило «есть права → есть задание» обязано быть одним и тем же в обоих
-- случаях: разъехавшись, они оставили бы задание на канале, где проверять
-- подписку уже нечем.
--
-- Проект ищется по chat_id, а если его ещё не знаем — по юзернейму в ссылке.
-- `like '%t.me/имя'` не путает `t.me/user` с `t.me/superuser`: перед именем
-- обязателен литеральный `t.me/`.
create function apply_channel_admin(
  p_chat_id  bigint,
  p_username text,
  p_is_admin boolean
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_project public.projects;
  v_reward  bigint;
begin
  select p.* into v_project
    from public.projects p
   where p.type = 'paid'
     and p.status = 'active'
     and (
       (p_chat_id is not null and p.tg_chat_id = p_chat_id)
       or (
         p_username is not null
         and lower(rtrim(p.url, '/')) like '%t.me/' || lower(p_username)
       )
     )
   -- Совпадение по chat_id точнее совпадения по ссылке.
   order by (p.tg_chat_id is not distinct from p_chat_id) desc
   limit 1;

  if v_project.id is null then
    return null;
  end if;

  update public.projects
     set tg_chat_id = coalesce(p_chat_id, tg_chat_id),
         tg_bot_is_admin = p_is_admin
   where id = v_project.id;

  if not p_is_admin then
    -- Прав больше нет — проверять подписку нечем. Задание уходит с экрана, а
    -- уже начисленные за него голоса остаются: отзыв наград задним числом в
    -- Этап 1 не входит (09 Открытые вопросы).
    update public.tasks
       set is_active = false
     where type = 'subscribe' and target_project_id = v_project.id;
    return v_project.id;
  end if;

  select (value ->> 'subscribe')::bigint into v_reward
    from public.app_config where key = 'task_rewards';

  insert into public.tasks (type, title, description, reward_votes, target_project_id)
  select
    'subscribe',
    'Subscribe to ' || coalesce('@' || p_username, v_project.name),
    'Stay subscribed to keep the votes.',
    coalesce(v_reward, 2),
    v_project.id
  where not exists (
    select 1 from public.tasks
     where type = 'subscribe' and target_project_id = v_project.id
  );

  -- Бота вернули после удаления — задание оживает вместе с правами, а не
  -- заводится вторым.
  update public.tasks
     set is_active = true
   where type = 'subscribe' and target_project_id = v_project.id and not is_active;

  return v_project.id;
end;
$$;

revoke all on function apply_channel_admin from public;
grant execute on function apply_channel_admin to service_role;

-- ---------------------------------------------------------------------------
-- Лента голосов и суточный разрез бесплатного топа
-- ---------------------------------------------------------------------------
--
-- Ровно те же две вьюхи, что у платного топа (миграция 20260902120000), только
-- по `vote_transactions`. Отдельные, а не общие с платными: метрики разные, и
-- смешивать очки с голосами в одном списке запрещает та же граница, по которой
-- деньги никогда не превращаются в голоса (01 Механики).
--
-- Кто отдал голос, вьюха не показывает — как `stake_activity` не показывает,
-- кто ударил. Публично известно, кому прибавилось.
create or replace view vote_activity as
select
  vt.id,
  vt.project_id,
  p.name as project_name,
  p.type as project_type,
  vt.amount,
  vt.source,
  vt.created_at
from vote_transactions vt
join projects p on p.id = vt.project_id and p.status = 'active'
order by vt.created_at desc;

grant select on vote_activity to anon, authenticated;

-- Окно скользящее, как у `paid_today_top`: календарные сутки рвали бы список в
-- полночь на ровном месте. Колонки повторяют выборку витрины, чтобы карточку
-- рисовал тот же код — меняется только число, по которому она отсортирована.
create or replace view free_today_top as
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
  coalesce(sum(vt.amount), 0)::bigint as today_votes
from projects p
join vote_transactions vt
  on vt.project_id = p.id
 and vt.created_at > now() - interval '24 hours'
where p.type = 'free' and p.status = 'active'
group by p.id;

grant select on free_today_top to anon, authenticated;
