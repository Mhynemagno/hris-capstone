-- Server-side search for the HR lists, and retired personnel kept out of promotion readiness.
--
-- `public.search_text(<row>)` functions are PostgREST computed fields: the browser filters on
-- `search_text` like a column (one `ilike` per typed word), so search covers every page instead of
-- only the ten rows already loaded, and a full name matches across the name columns.
-- They run as the caller (security invoker), so row-level security still decides what is visible.

create or replace function public.search_text(public.employees)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(concat_ws(' ', $1.employee_number, $1.first_name, $1.middle_name, $1.last_name));
$$;

create or replace function public.search_text(public.attendance_logs)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(concat_ws(' ', $1.external_employee_id,
    (select public.search_text(employee) from public.employees employee where employee.id = $1.employee_id)));
$$;

create or replace function public.search_text(public.leave_requests)
returns text
language sql
stable
set search_path = ''
as $$
  select (select public.search_text(employee) from public.employees employee where employee.id = $1.employee_id);
$$;

create or replace function public.search_text(public.deployments)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(concat_ws(' ', $1.location,
    (select public.search_text(employee) from public.employees employee where employee.id = $1.employee_id)));
$$;

revoke all on function public.search_text(public.employees) from public, anon;
revoke all on function public.search_text(public.attendance_logs) from public, anon;
revoke all on function public.search_text(public.leave_requests) from public, anon;
revoke all on function public.search_text(public.deployments) from public, anon;
grant execute on function public.search_text(public.employees) to authenticated, service_role;
grant execute on function public.search_text(public.attendance_logs) to authenticated, service_role;
grant execute on function public.search_text(public.leave_requests) to authenticated, service_role;
grant execute on function public.search_text(public.deployments) to authenticated, service_role;

-- Retired personnel are not promotion candidates: the HR list and the dashboard's Promotion Notice
-- leave them out. Looking up one employee by id still returns their latest review.
create or replace function public.list_promotion_readiness(target_employee_id uuid default null)
returns table (
  employee_id uuid,
  employee_name text,
  evaluation_id uuid,
  target_rank_id integer,
  target_rank_name text,
  evaluated_on date,
  recommendation text,
  readiness jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_active_hr();
  return query
  select
    latest.employee_id,
    concat_ws(', ', employee.last_name, employee.first_name),
    latest.id,
    latest.target_rank_id,
    rank.name,
    latest.evaluated_on,
    latest.recommendation,
    private.promotion_readiness(latest.employee_id, latest.criterion_id, (now() at time zone 'Asia/Manila')::date)
  from (
    select distinct on (evaluation.employee_id) evaluation.*
    from public.promotion_evaluations evaluation
    where target_employee_id is null or evaluation.employee_id = target_employee_id
    order by evaluation.employee_id, evaluation.evaluated_on desc, evaluation.created_at desc
  ) latest
  join public.employees employee on employee.id = latest.employee_id
  join public.ranks rank on rank.id = latest.target_rank_id
  where target_employee_id is not null or employee.employment_status = 'active'
  order by employee.last_name, employee.first_name;
end;
$$;

revoke all on function public.list_promotion_readiness(uuid) from public, anon;
grant execute on function public.list_promotion_readiness(uuid) to authenticated, service_role;

-- The paged list gains a search argument (every word must match the name, badge number or target
-- rank), so the old three-argument signature is replaced.
drop function if exists public.list_promotion_readiness_page(integer, integer, uuid);

create function public.list_promotion_readiness_page(
  target_page integer,
  target_page_size integer,
  target_employee_id uuid default null,
  target_search text default null
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
  terms text[] := (
    select coalesce(array_agg(term), '{}')
    from (
      select term
      from regexp_split_to_table(lower(btrim(coalesce(target_search, ''))), '\s+') term
      where term <> ''
      limit 6
    ) words
  );
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
      latest.recommendation, private.promotion_readiness(latest.employee_id, latest.criterion_id, (now() at time zone 'Asia/Manila')::date) as readiness,
      lower(concat_ws(' ', public.search_text(employee), rank.name, rank.code)) as haystack
    from latest join public.employees employee on employee.id = latest.employee_id join public.ranks rank on rank.id = latest.target_rank_id
    where target_employee_id is not null or employee.employment_status = 'active'
  )
  select rows.employee_id, rows.employee_name, rows.evaluation_id, rows.target_rank_id, rows.target_rank_name,
    rows.evaluated_on, rows.recommendation, rows.readiness, count(*) over() as total_count
  from rows
  where not exists (select 1 from unnest(terms) term where strpos(rows.haystack, term) = 0)
  order by rows.employee_name, rows.employee_id offset (safe_page - 1) * safe_page_size limit safe_page_size;
end;
$$;

revoke all on function public.list_promotion_readiness_page(integer, integer, uuid, text) from public, anon;
grant execute on function public.list_promotion_readiness_page(integer, integer, uuid, text) to authenticated, service_role;
