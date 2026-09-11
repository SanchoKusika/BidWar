-- Задание «зайти в проект» засчитывается только за ПЛАТНЫЙ проект.
--
-- Смысл задания — гнать трафик туда, за что заплачено: платная позиция куплена
-- ради переходов, и голос за неё — часть сделки. Клик по бесплатному проекту
-- трафик тоже даёт, но платить за него голосом не за что: бесплатная позиция
-- зарабатывается голосами, а не раздаёт их.
--
-- Считалось это неправильно с самого 1.7, причём наполовину: знаменатель
-- прогресса уже брался как «число активных платных проектов»
-- (`_shared/tasks.ts`, `ctx.paidProjects`), а засчитывался любой клик. Отсюда
-- и брался прогресс вида «5 из 18», где часть пятёрки — бесплатные проекты.
--
-- Счётчик кликов при этом остаётся общим: он считает переходы, а не награды, и
-- бесплатному проекту они нужны ровно так же.
create or replace function register_project_click(p_project_id bigint, p_user_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_counted boolean;
  v_type    text;
begin
  insert into public.project_clicks (project_id, user_id, day)
  values (p_project_id, p_user_id, current_date)
  on conflict do nothing;

  v_counted := found;

  if v_counted then
    update public.projects set clicks = clicks + 1 where id = p_project_id
    returning type into v_type;

    if v_type = 'paid' then
      perform public.apply_task_completion(p_user_id, 'visit', p_project_id);
    end if;
  end if;

  return v_counted;
end;
$$;

-- Строка задания в базе тоже перестаёт обещать «любой проект». В интерфейсе
-- подписи берутся из словаря (`entities/task/taskCopy`), но база — источник для
-- всех остальных читателей, и врать ей незачем.
update public.tasks
   set title = 'Push a paid project',
       description = 'Open a project from the Paid Top. One vote per project, once a day.'
 where type = 'visit' and target_project_id is null;
