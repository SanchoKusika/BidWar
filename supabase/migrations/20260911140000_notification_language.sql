-- Срез 1.9, клиентская часть: язык человека уезжает на сервер.
--
-- Настройки в приложении живут в `localStorage` — это правильно для темы,
-- валюты показа и компактных сумм: они про устройство зрителя. С языком так не
-- получается, и врала ровно подпись в настройках: «Language and theme apply to
-- the bot and the site too». Боту `localStorage` не виден, и до сих пор он мог
-- ориентироваться только на язык оболочки Telegram — то есть игнорировать
-- сделанный руками выбор.
--
-- Колонка пустая по умолчанию, и это не то же самое, что 'EN': null означает
-- «человек не выбирал», и тогда бот берёт язык оболочки, как и мини-апп при
-- первом запуске.
alter table users add column language text
  check (language is null or language in ('RU', 'UZ', 'EN'));

comment on column users.language is
  'Язык, выбранный руками в мини-аппе; null — не выбирал, берётся язык оболочки Telegram';

-- Выбор человека важнее языка оболочки. Всё остальное в функции не меняется —
-- тип возврата тот же, поэтому `create or replace`, а не пересоздание.
create or replace function claim_notifications(p_limit int default 25)
returns table (
  id            bigint,
  kind          text,
  payload       jsonb,
  chat_id       text,
  language_code text
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  with due as (
    select n.id
      from public.notifications n
     where n.sent_at is null
       and n.send_after <= now()
       and n.attempts < 5
     order by n.send_after
     limit greatest(1, coalesce(p_limit, 25))
     for update skip locked
  ),
  claimed as (
    update public.notifications n
       set attempts = n.attempts + 1
      from due
     where n.id = due.id
     returning n.id, n.kind, n.payload, n.user_id
  )
  select c.id, c.kind, c.payload, ai.provider_uid,
         coalesce(u.language, ai.meta ->> 'language_code')
    from claimed c
    join public.auth_identities ai
      on ai.user_id = c.user_id and ai.provider = 'telegram'
    join public.users u
      on u.id = c.user_id;
end;
$$;

revoke all on function claim_notifications(int) from public, anon, authenticated;
grant execute on function claim_notifications(int) to service_role;
