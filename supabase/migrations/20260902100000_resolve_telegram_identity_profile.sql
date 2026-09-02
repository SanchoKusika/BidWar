-- Профиль показывает «имя · @хендл · с какого числа», а справа аватар — так он
-- нарисован в ките и так его просили. Хендла и даты регистрации у клиента до
-- сих пор не было ни в каком виде: `auth` возвращал только имя, аватар и
-- баланс голосов, а `users` вообще не хранит телеграм-ник — он лежит в
-- `auth_identities.meta`, куда его кладёт эта же функция.
--
-- Заодно отдаём число приглашённых: реферальная карточка в профиле рисовала
-- захардкоженные 7 и 350 (мелкий дефект из [[12 Состояние реализации]]).
-- Считается тем же запросом по `users_referrer_idx`, отдельный поход в базу
-- ради одного числа заводить незачем. Начисленные голоса тут не считаются —
-- их источника (`vote_transactions`) не будет до среза 1.7.
--
-- Хендл берётся из `p_meta`, а не из сохранённой строки: initData приносит
-- его свежим на каждый вход, и человек, сменивший ник, увидит новый.
--
-- Тип возврата меняется, поэтому drop + create, а не create or replace.
drop function if exists resolve_telegram_identity(text, text, text, jsonb, uuid);

create function resolve_telegram_identity(
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
  vote_balance bigint,
  username text,
  joined_at timestamptz,
  invited_count bigint
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

    -- Алиас обязателен: RETURNS TABLE заводит одноимённые переменные, и голая
    -- avatar_url здесь ссылалась бы на них, а не на колонку (см. миграцию
    -- 20260828140000 — именно на этом auth падал на втором входе).
    update public.users u
    set display_name = p_display_name, avatar_url = coalesce(p_avatar_url, u.avatar_url)
    where u.id = v_user_id;
  end if;

  return query
    select
      u.id,
      v_is_new,
      u.display_name,
      u.avatar_url,
      u.vote_balance,
      nullif(p_meta->>'username', ''),
      u.created_at,
      (select count(*) from public.users r where r.referrer_id = u.id)
    from public.users u
    where u.id = v_user_id;
end;
$$;

revoke all on function resolve_telegram_identity from public;
grant execute on function resolve_telegram_identity to service_role;
