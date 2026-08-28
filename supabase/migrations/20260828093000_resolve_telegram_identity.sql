-- Срез 1.2 (Авторизация): один RPC для «войти через Telegram».
--
-- Ищет auth_identities по (provider, provider_uid); если пользователя ещё
-- нет — создаёт users + auth_identities одной транзакцией и применяет
-- referrer_id (только при создании — повторный вызов его не переписывает).
-- Если есть — обновляет meta и видимые поля (username/фото могли смениться).
--
-- advisory-lock на telegram_id закрывает гонку двух параллельных первых
-- заходов одним и тем же пользователем: без него оба запроса могут одновременно
-- не найти identity и попытаться создать по строке каждый, упершись в
-- UNIQUE(provider, provider_uid) с необработанным исключением.
create or replace function resolve_telegram_identity(
  p_telegram_id text,
  p_display_name text,
  p_avatar_url text,
  p_meta jsonb,
  p_referrer_id uuid
) returns table (user_id uuid, is_new boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_referrer_id uuid := p_referrer_id;
begin
  perform pg_advisory_xact_lock(hashtext('telegram:' || p_telegram_id));

  -- Реферер мог удалиться из ссылки давно устаревшей/битой — тише
  -- проигнорировать несуществующий id, чем ронять всю регистрацию FK-ошибкой.
  if v_referrer_id is not null and not exists (
    select 1 from public.users u where u.id = v_referrer_id
  ) then
    v_referrer_id := null;
  end if;

  select ai.user_id into v_user_id
  from public.auth_identities ai
  where ai.provider = 'telegram' and ai.provider_uid = p_telegram_id;

  if v_user_id is null then
    insert into public.users (display_name, avatar_url, referrer_id)
    values (p_display_name, p_avatar_url, v_referrer_id)
    returning id into v_user_id;

    insert into public.auth_identities (user_id, provider, provider_uid, meta)
    values (v_user_id, 'telegram', p_telegram_id, p_meta);

    return query select v_user_id, true;
  else
    update public.auth_identities
    set meta = p_meta
    where provider = 'telegram' and provider_uid = p_telegram_id;

    -- p_avatar_url — null у любого апдейта из вебхука бота (Bot API его не
    -- отдаёт вообще, только initData Mini App иногда) и у initData без
    -- фото. Затирать сохранённый avatar_url отсутствием значения нельзя —
    -- coalesce меняет его только когда пришло реальное новое фото.
    update public.users
    set display_name = p_display_name, avatar_url = coalesce(p_avatar_url, avatar_url)
    where id = v_user_id;

    return query select v_user_id, false;
  end if;
end;
$$;

-- Вызывается только из Edge Functions через service_role, у которого и так
-- есть доступ к таблицам напрямую — revoke от anon/authenticated на всякий
-- случай, чтобы функцию нельзя было дёрнуть в обход проверки initData.
revoke all on function resolve_telegram_identity from public;
grant execute on function resolve_telegram_identity to service_role;
