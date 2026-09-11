-- Срез 1.9, вторая половина: кто и как забирает созревшие уведомления.
--
-- Отправляет функция `notify` — в базе сети нет и быть не должно. Здесь три
-- вещи: захват пачки строк, отметки о результате и расписание, которое будит
-- функцию.
--
-- Решение о безопасности: `notify` вызывается без Supabase-сессии (её у
-- расписания нет), поэтому у неё `verify_jwt = false` и общий секрет в
-- заголовке — та же схема, что у вебхука бота. Альтернатива — класть в задание
-- ключ `service_role`: он открывает всю базу, а секрет отправщика — только
-- отправку уже сформированных сообщений.

-- ---------------------------------------------------------------------------
-- 1. Захват пачки
-- ---------------------------------------------------------------------------
--
-- `for update skip locked` — чтобы два одновременных прохода не взяли одну
-- строку и человек не получил сообщение дважды. Счётчик попыток растёт в момент
-- захвата, а не после ответа Telegram: строка, на которой отправщик умер, иначе
-- захватывалась бы вечно.
--
-- Адрес и язык приезжают вместе со строкой: отдельный запрос на каждое
-- сообщение — это лишний round-trip на каждое из двадцати пяти.
create function claim_notifications(p_limit int default 25)
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
  -- join, а не left join: человек без телеграм-личности недостижим, и слать
  -- ему некуда. Такие строки доживут до пятой попытки и перестанут
  -- захватываться — в Этапе 1 их взяться неоткуда, вход только через Telegram.
  select c.id, c.kind, c.payload, ai.provider_uid, ai.meta ->> 'language_code'
    from claimed c
    join public.auth_identities ai
      on ai.user_id = c.user_id and ai.provider = 'telegram';
end;
$$;

comment on function claim_notifications is
  'Забирает пачку созревших уведомлений вместе с адресом получателя; помечает попытку';

revoke all on function claim_notifications(int) from public, anon, authenticated;
grant execute on function claim_notifications(int) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Отметки о результате
-- ---------------------------------------------------------------------------
--
-- Три исхода, а не два. `sent` — дошло. `failed` — не дошло, но попробовать
-- стоит: сеть, лимит Bot API. `drop` — не дошло и не дойдёт: человек не начинал
-- диалог с ботом или заблокировал его; такая строка гасится сразу, иначе один
-- молчащий адресат стоит пяти вызовов Bot API на каждое своё событие.
create function mark_notification_sent(p_id bigint)
returns void
language sql
set search_path = ''
as $$
  update public.notifications
     set sent_at = now(), last_error = null
   where id = p_id and sent_at is null;
$$;

create function mark_notification_failed(p_id bigint, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.notifications
     set last_error = left(coalesce(p_error, ''), 500)
   where id = p_id and sent_at is null;
$$;

create function drop_notification(p_id bigint, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.notifications
     set attempts = 5, last_error = left(coalesce(p_error, ''), 500)
   where id = p_id and sent_at is null;
$$;

revoke all on function mark_notification_sent(bigint) from public, anon, authenticated;
revoke all on function mark_notification_failed(bigint, text) from public, anon, authenticated;
revoke all on function drop_notification(bigint, text) from public, anon, authenticated;
grant execute on function mark_notification_sent(bigint) to service_role;
grant execute on function mark_notification_failed(bigint, text) to service_role;
grant execute on function drop_notification(bigint, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Расписание
-- ---------------------------------------------------------------------------
--
-- Минута — не частота сообщений, а точность окна склейки: сами окна лежат в
-- `app_config.notification_delays` и измеряются минутами и часами.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Адрес функции и секрет — в Vault, а не в тексте задания: `cron.job` читается
-- всеми, у кого есть доступ к базе, и секрет из него уже не отозвать.
-- Заводятся один раз руками (README, раздел про уведомления):
--
--   select vault.create_secret('<секрет>', 'notify_secret');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify', 'notify_url');
create function drain_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url    text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'notify_url';

  -- Не настроено — молчим. Задание, падающее каждую минуту, засоряет журнал
  -- ровно тем шумом, из-за которого потом не видно настоящей поломки.
  if v_secret is null or v_url is null then
    return;
  end if;

  -- Схема `net`, а не `extensions`: pg_net заводит её сам, независимо от того,
  -- в какой схеме создано само расширение.
  perform net.http_post(
    url     := v_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-notify-secret', v_secret
    ),
    timeout_milliseconds := 20000
  );
end;
$$;

comment on function drain_notifications is
  'Будит Edge Function notify. Адрес и секрет берёт из Vault; ничего не делает, пока их там нет';

revoke all on function drain_notifications() from public, anon, authenticated;

select cron.schedule('drain-notifications', '* * * * *', $$select public.drain_notifications()$$);
