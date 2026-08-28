-- Срез 1.4: клик по карточке засчитывается не чаще раза в сутки на человека
-- (01 Механики.md, 03 Данные.md). Инкремент денормализованного счётчика и
-- вставка в project_clicks — одна транзакция, а не два похода с фронта:
-- конфликт по PK молча значит "уже кликал сегодня", counter не растёт.
create function register_project_click(p_project_id bigint, p_user_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_counted boolean;
begin
  insert into public.project_clicks (project_id, user_id, day)
  values (p_project_id, p_user_id, current_date)
  on conflict do nothing;

  v_counted := found;

  if v_counted then
    update public.projects set clicks = clicks + 1 where id = p_project_id;
  end if;

  return v_counted;
end;
$$;

revoke all on function register_project_click from public;
grant execute on function register_project_click to service_role;
