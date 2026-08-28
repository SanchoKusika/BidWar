-- leader_name один сравнением по строке ненадёжен: projects.name уникальности
-- не имеет (код-ревью PR #10) — два проекта с одинаковым названием в одной
-- категории давали корону не тому. leader_id добавлен последней колонкой
-- специально, чтобы CREATE OR REPLACE VIEW прошёл без пересоздания
-- (Postgres требует сохранить порядок существующих колонок).
create or replace view category_stats as
select
  c.id as category_id,
  c.slug,
  c.title,
  c.sort_order,
  'paid'::text as type,
  count(pr.id) filter (where pr.status = 'active') as project_count,
  coalesce(sum(pr.paid_amount) filter (where pr.status = 'active'), 0) as pool,
  (array_agg(pr.name order by pr.paid_amount desc, pr.id asc)
    filter (where pr.status = 'active'))[1] as leader_name,
  (array_agg(pr.id order by pr.paid_amount desc, pr.id asc)
    filter (where pr.status = 'active'))[1] as leader_id
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
    filter (where pr.status = 'active'))[1],
  (array_agg(pr.id order by pr.votes desc, pr.id asc)
    filter (where pr.status = 'active'))[1]
from categories c
left join projects pr on pr.category_id = c.id and pr.type = 'free'
where c.is_active
group by c.id, c.slug, c.title, c.sort_order;
