-- Срез 1.3 (Витрины и категории): агрегаты для плиток категорий —
-- пул, число проектов, лидер, отдельно для paid и free (разные экономики,
-- разные витрины). Позиция самого проекта сюда не входит — она считается
-- клиентом напрямую через PostgREST-count с тай-брейком (id ASC), отдельного
-- RPC под это заводить незачем, чтение витрин и так идёт напрямую.
create view category_stats as
select
  c.id as category_id,
  c.slug,
  c.title,
  c.sort_order,
  'paid'::text as type,
  count(pr.id) filter (where pr.status = 'active') as project_count,
  coalesce(sum(pr.paid_amount) filter (where pr.status = 'active'), 0) as pool,
  (array_agg(pr.name order by pr.paid_amount desc, pr.id asc)
    filter (where pr.status = 'active'))[1] as leader_name
from categories c
left join projects pr on pr.category_id = c.id and pr.type = 'paid'
where c.is_active
group by c.id, c.slug, c.title, c.sort_order

union all

select
  c.id,
  c.slug,
  c.title,
  c.sort_order,
  'free'::text,
  count(pr.id) filter (where pr.status = 'active'),
  coalesce(sum(pr.votes) filter (where pr.status = 'active'), 0),
  (array_agg(pr.name order by pr.votes desc, pr.id asc)
    filter (where pr.status = 'active'))[1]
from categories c
left join projects pr on pr.category_id = c.id and pr.type = 'free'
where c.is_active
group by c.id, c.slug, c.title, c.sort_order;

-- Вид выполняется с правами вызывающей роли (обычный view, не security
-- definer) — RLS на projects всё равно фильтрует до status='active' для
-- anon, filter(...) выше защищает от service_role, который RLS обходит.
-- anon, authenticated — тот же набор ролей, что и у остальных публичных
-- таблиц (categories, projects, tasks) в исходной миграции.
grant select on category_stats to anon, authenticated;
