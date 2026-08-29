-- Баг: RETURNS TABLE (..., avatar_url text, ...) неявно заводит PL/pgSQL-
-- переменную avatar_url на весь текст функции. В ветке "уже есть identity"
-- было `coalesce(p_avatar_url, avatar_url)` — голая avatar_url конфликтовала
-- с одноимённой колонкой users, из-за чего Postgres падал с
-- "column reference avatar_url is ambiguous". В ветке "новый юзер" такого
-- выражения не было, поэтому баг проявлялся только у уже существующих
-- пользователей (auth падал с internal_error на втором и последующих входах).
-- Правка: обновляемая таблица получает алиас, колонка читается через него.
create or replace function resolve_telegram_identity(
  p_telegram_id text,
  p_display_name text,
  p_avatar_url text,
  p_meta jsonb,
  p_referrer_id uuid
) returns table (
  user_id uuid,
  is_new boolean,
  display_name text,
  avatar_url text,
  vote_balance bigint
)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_referrer_id uuid := p_referrer_id;
  v_is_new boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('telegram:' || p_telegram_id));

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

    v_is_new := true;
  else
    update public.auth_identities
    set meta = p_meta
    where provider = 'telegram' and provider_uid = p_telegram_id;

    update public.users u
    set display_name = p_display_name, avatar_url = coalesce(p_avatar_url, u.avatar_url)
    where u.id = v_user_id;
  end if;

  return query
    select u.id, v_is_new, u.display_name, u.avatar_url, u.vote_balance
    from public.users u
    where u.id = v_user_id;
end;
$$;

revoke all on function resolve_telegram_identity from public;
grant execute on function resolve_telegram_identity to service_role;
