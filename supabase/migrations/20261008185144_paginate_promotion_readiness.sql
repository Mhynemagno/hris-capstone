create or replace function public.list_promotion_readiness_page(
  target_page integer,
  target_page_size integer,
  target_employee_id uuid default null
)
returns table (
  employee_id uuid,
  employee_name text,
  evaluation_id uuid,
  target_rank_id integer,
  target_rank_name text,
  evaluated_on date,
  recommendation text,
  readiness jsonb,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(target_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(target_page_size, 25), 1), 100);
begin
  perform private.require_active_hr();
  return query
  with latest as (
    select distinct on (evaluation.employee_id) evaluation.*
    from public.promotion_evaluations evaluation
    where target_employee_id is null or evaluation.employee_id = target_employee_id
    order by evaluation.employee_id, evaluation.evaluated_on desc, evaluation.created_at desc
  ), rows as (
    select latest.employee_id, concat_ws(', ', employee.last_name, employee.first_name) as employee_name,
      latest.id as evaluation_id, latest.target_rank_id, rank.name as target_rank_name, latest.evaluated_on,
      latest.recommendation, private.promotion_readiness(latest.employee_id, latest.criterion_id, (now() at time zone 'Asia/Manila')::date) as readiness
    from latest join public.employees employee on employee.id = latest.employee_id join public.ranks rank on rank.id = latest.target_rank_id
  )
  select rows.*, count(*) over() as total_count from rows
  order by employee_name offset (safe_page - 1) * safe_page_size limit safe_page_size;
end;
$$;

revoke all on function public.list_promotion_readiness_page(integer, integer, uuid) from public, anon;
grant execute on function public.list_promotion_readiness_page(integer, integer, uuid) to authenticated, service_role;
