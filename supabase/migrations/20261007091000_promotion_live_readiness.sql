-- Live promotion readiness (tester feedback, 2026-10-07):
--   A certification added after HR saved a promotion review never showed up in Promotion, because
--   create_promotion_evaluation stores missing_requirements and is_ready once and nothing
--   recalculates them. Readiness is now worked out live from the employee's current records:
--     * private.promotion_readiness(employee, criterion, on_date) applies the same rules as
--       create_promotion_evaluation (service years, optional rating minimum, mandatory requirements).
--       A certification requirement is also met by a training record of the same name, because the
--       personnel record merges them as "Certification / Training".
--     * public.list_promotion_readiness(employee?) gives HR one row per reviewed employee, from that
--       employee's latest review, with readiness as of today.
--     * public.get_my_promotion_readiness() gives the signed-in employee the same for themselves.
--   Stored evaluations stay as the historical record of what HR decided.

create or replace function private.promotion_readiness(target_employee_id uuid, target_criterion_id uuid, target_on date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  employee_row public.employees%rowtype;
  criterion_row public.promotion_criteria%rowtype;
  requirement_row public.promotion_criteria_requirements%rowtype;
  years integer;
  rating_value integer;
  rating_ok boolean;
  has_record boolean;
  requirements jsonb := '[]'::jsonb;
  missing jsonb := '[]'::jsonb;
begin
  select * into employee_row from public.employees where id = target_employee_id;
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id;
  if employee_row.id is null or criterion_row.id is null then return null; end if;

  years := greatest(0, extract(year from age(target_on, employee_row.employment_started_on))::integer);
  select rating into rating_value from public.performance_ratings where employee_id = target_employee_id and review_period_ends_on <= target_on order by review_period_ends_on desc, created_at desc limit 1;
  rating_ok := criterion_row.minimum_performance_rating is null or coalesce(rating_value, 0) >= criterion_row.minimum_performance_rating;

  for requirement_row in select * from public.promotion_criteria_requirements where criterion_id = criterion_row.id and is_mandatory order by ordinal loop
    has_record := case requirement_row.record_kind
      when 'qualification' then exists (select 1 from public.qualifications where employee_id = target_employee_id and lower(btrim(name)) = lower(requirement_row.required_name))
      else exists (select 1 from public.certifications where employee_id = target_employee_id and lower(btrim(name)) = lower(requirement_row.required_name) and (expires_on is null or expires_on >= target_on))
        or exists (select 1 from public.training_records where employee_id = target_employee_id and lower(btrim(course_name)) = lower(requirement_row.required_name) and (expires_on is null or expires_on >= target_on))
    end;
    requirements := requirements || jsonb_build_array(jsonb_build_object('label', requirement_row.label, 'met', has_record));
    if not has_record then missing := missing || jsonb_build_array(requirement_row.label); end if;
  end loop;

  return jsonb_build_object(
    'yearsOfService', years,
    'minimumYearsOfService', criterion_row.minimum_years_of_service,
    'isReady', years >= criterion_row.minimum_years_of_service and rating_ok and jsonb_array_length(missing) = 0,
    'missingRequirements', missing,
    'requirements', requirements
  );
end;
$$;

revoke all on function private.promotion_readiness(uuid, uuid, date) from public, anon, authenticated;

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
  order by employee.last_name, employee.first_name;
end;
$$;

revoke all on function public.list_promotion_readiness(uuid) from public, anon;
grant execute on function public.list_promotion_readiness(uuid) to authenticated, service_role;

create or replace function public.get_my_promotion_readiness()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'targetRankName', rank.name,
    'evaluatedOn', evaluation.evaluated_on,
    'readiness', private.promotion_readiness(evaluation.employee_id, evaluation.criterion_id, (now() at time zone 'Asia/Manila')::date)
  )
  from public.employees employee
  join public.promotion_evaluations evaluation on evaluation.employee_id = employee.id
  join public.ranks rank on rank.id = evaluation.target_rank_id
  where employee.profile_id = (select auth.uid())
  order by evaluation.evaluated_on desc, evaluation.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_promotion_readiness() from public, anon;
grant execute on function public.get_my_promotion_readiness() to authenticated, service_role;
