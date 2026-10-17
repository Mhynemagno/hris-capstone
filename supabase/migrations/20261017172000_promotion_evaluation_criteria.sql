-- Promotion readiness is advisory. These additions supply the approved evaluation
-- groups from authoritative HR records and never update an employee's rank.

alter table public.promotion_criteria
  add column minimum_time_in_grade_years integer check (minimum_time_in_grade_years is null or minimum_time_in_grade_years between 1 and 30),
  add column iper_review_period_months integer check (iper_review_period_months is null or iper_review_period_months between 1 and 60),
  add column pft_minimum_score numeric(5, 2) check (pft_minimum_score is null or pft_minimum_score between 0 and 100),
  add column pft_validity_months integer check (pft_validity_months is null or pft_validity_months between 1 and 60);

update public.promotion_criteria set iper_review_period_months = 12 where minimum_performance_rating is not null;

alter table public.promotion_criteria
  add constraint promotion_criteria_iper_pair check ((minimum_performance_rating is null) = (iper_review_period_months is null)),
  add constraint promotion_criteria_pft_pair check ((pft_minimum_score is null) = (pft_validity_months is null));

create table public.physical_fitness_results (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  score numeric(5, 2) not null check (score between 0 and 100),
  assessed_on date not null,
  valid_until date not null,
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  recorded_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (valid_until >= assessed_on)
);
create index physical_fitness_results_employee_valid_idx on public.physical_fitness_results (employee_id, valid_until desc);
alter table public.physical_fitness_results enable row level security;
revoke all on public.physical_fitness_results from anon, authenticated;
grant select on public.physical_fitness_results to authenticated;
create policy physical_fitness_results_select_hr_or_own on public.physical_fitness_results for select to authenticated using (
  (select private.current_user_has_role('hr_personnel'::public.app_role)) or exists (select 1 from public.employees where employees.id = physical_fitness_results.employee_id and employees.profile_id = (select auth.uid()))
);

create or replace function public.record_physical_fitness_result(target_employee_id uuid, target_score numeric, target_assessed_on date, target_valid_until date, target_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); result_id uuid; clean_notes text := nullif(btrim(target_notes), '');
begin
  if target_score not between 0 and 100 or target_valid_until < target_assessed_on or clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Physical fitness result is invalid.' using errcode = '22023'; end if;
  if not exists (select 1 from public.employees where id = target_employee_id) then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  insert into public.physical_fitness_results (employee_id, score, assessed_on, valid_until, notes, recorded_by_user_id) values (target_employee_id, target_score, target_assessed_on, target_valid_until, clean_notes, caller_id) returning id into result_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'physical_fitness_results', result_id::text, 'created', jsonb_build_object('employee_id', target_employee_id));
  return result_id;
end;
$$;

create or replace function public.create_promotion_criterion(target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_requirements jsonb, target_time_in_grade_years integer, target_iper_period_months integer, target_pft_minimum_score numeric, target_pft_validity_months integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); criterion_id uuid; item jsonb; ordinal_value integer := 0; kind_value text; name_value text; label_value text;
begin
  if target_minimum_years not between 0 and 100 or target_time_in_grade_years is not null and target_time_in_grade_years not between 1 and 30 or (target_minimum_rating is null) <> (target_iper_period_months is null) or target_minimum_rating is not null and (target_minimum_rating not between 1 and 5 or target_iper_period_months not between 1 and 60) or (target_pft_minimum_score is null) <> (target_pft_validity_months is null) or target_pft_minimum_score is not null and (target_pft_minimum_score not between 0 and 100 or target_pft_validity_months not between 1 and 60) or jsonb_typeof(target_requirements) <> 'array' or jsonb_array_length(target_requirements) > 30 then raise exception 'Promotion criteria are invalid.' using errcode = '22023'; end if;
  if not exists (select 1 from public.ranks where id = target_rank_id) then raise exception 'Target rank was not found.' using errcode = 'P0001'; end if;
  insert into public.promotion_criteria (target_rank_id, minimum_years_of_service, minimum_performance_rating, minimum_time_in_grade_years, iper_review_period_months, pft_minimum_score, pft_validity_months, created_by_user_id, updated_by_user_id)
  values (target_rank_id, target_minimum_years, target_minimum_rating, target_time_in_grade_years, target_iper_period_months, target_pft_minimum_score, target_pft_validity_months, caller_id, caller_id) returning id into criterion_id;
  for item in select value from jsonb_array_elements(target_requirements) loop
    ordinal_value := ordinal_value + 1; kind_value := item ->> 'recordKind'; name_value := btrim(item ->> 'requiredName'); label_value := btrim(item ->> 'label');
    if kind_value not in ('qualification', 'certification', 'training') or name_value is null or name_value = '' or label_value is null or label_value = '' then raise exception 'Promotion requirement is invalid.' using errcode = '22023'; end if;
    insert into public.promotion_criteria_requirements (criterion_id, ordinal, record_kind, required_name, label, is_mandatory) values (criterion_id, ordinal_value, kind_value, name_value, label_value, coalesce((item ->> 'isMandatory')::boolean, true));
  end loop;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_criteria', criterion_id::text, 'created', jsonb_build_object('target_rank_id', target_rank_id));
  return criterion_id;
end;
$$;

-- Retain the original four-argument RPC for older clients and seeded fixtures. Its
-- previous rating behavior now uses the standard 12-month IPER review window.
create or replace function public.create_promotion_criterion(target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_requirements jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return public.create_promotion_criterion(target_rank_id, target_minimum_years, target_minimum_rating, target_requirements, null, case when target_minimum_rating is null then null else 12 end, null, null);
end;
$$;

create or replace function private.promotion_readiness(target_employee_id uuid, target_criterion_id uuid, target_on date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  employee_row public.employees%rowtype; criterion_row public.promotion_criteria%rowtype; requirement_row public.promotion_criteria_requirements%rowtype;
  years integer; grade_started_on date; grade_years integer; rating_value integer; rating_ok boolean; pft_ok boolean; has_record boolean;
  requirements jsonb := '[]'::jsonb; missing jsonb := '[]'::jsonb;
begin
  select * into employee_row from public.employees where id = target_employee_id;
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id;
  if employee_row.id is null or criterion_row.id is null then return null; end if;
  years := greatest(0, extract(year from age(target_on, employee_row.employment_started_on))::integer);
  select min(history.started_on) into grade_started_on from public.service_history history where history.employee_id = target_employee_id and history.rank_id = employee_row.rank_id and history.started_on <= target_on;
  grade_started_on := coalesce(grade_started_on, employee_row.employment_started_on);
  grade_years := greatest(0, extract(year from age(target_on, grade_started_on))::integer);
  if criterion_row.minimum_time_in_grade_years is not null then
    has_record := grade_years >= criterion_row.minimum_time_in_grade_years;
    requirements := requirements || jsonb_build_array(jsonb_build_object('label', 'Time in Grade (' || criterion_row.minimum_time_in_grade_years || ' years)', 'met', has_record));
    if not has_record then missing := missing || jsonb_build_array('Time in Grade (' || criterion_row.minimum_time_in_grade_years || ' years)'); end if;
  end if;
  select rating into rating_value from public.performance_ratings where employee_id = target_employee_id and review_period_ends_on <= target_on and (criterion_row.iper_review_period_months is null or review_period_ends_on >= target_on - make_interval(months => criterion_row.iper_review_period_months)) order by review_period_ends_on desc, created_at desc limit 1;
  rating_ok := criterion_row.minimum_performance_rating is null or coalesce(rating_value, 0) >= criterion_row.minimum_performance_rating;
  if criterion_row.minimum_performance_rating is not null then
    requirements := requirements || jsonb_build_array(jsonb_build_object('label', 'IPER rating ' || criterion_row.minimum_performance_rating || '+ within ' || criterion_row.iper_review_period_months || ' months', 'met', rating_ok));
    if not rating_ok then missing := missing || jsonb_build_array('IPER rating ' || criterion_row.minimum_performance_rating || '+ within ' || criterion_row.iper_review_period_months || ' months'); end if;
  end if;
  pft_ok := criterion_row.pft_minimum_score is null or exists (select 1 from public.physical_fitness_results result where result.employee_id = target_employee_id and result.score >= criterion_row.pft_minimum_score and result.assessed_on between target_on - make_interval(months => criterion_row.pft_validity_months) and target_on and result.valid_until >= target_on);
  if criterion_row.pft_minimum_score is not null then
    requirements := requirements || jsonb_build_array(jsonb_build_object('label', 'PFT score ' || criterion_row.pft_minimum_score || '+ (valid ' || criterion_row.pft_validity_months || ' months)', 'met', pft_ok));
    if not pft_ok then missing := missing || jsonb_build_array('PFT score ' || criterion_row.pft_minimum_score || '+ (valid ' || criterion_row.pft_validity_months || ' months)'); end if;
  end if;
  for requirement_row in select * from public.promotion_criteria_requirements where criterion_id = criterion_row.id and is_mandatory order by ordinal loop
    has_record := case requirement_row.record_kind
      when 'qualification' then exists (select 1 from public.qualifications where employee_id = target_employee_id and lower(btrim(name)) = lower(requirement_row.required_name))
      when 'certification' then exists (select 1 from public.certifications where employee_id = target_employee_id and lower(btrim(name)) = lower(requirement_row.required_name) and (expires_on is null or expires_on >= target_on))
        or exists (select 1 from public.training_records where employee_id = target_employee_id and lower(btrim(course_name)) = lower(requirement_row.required_name) and (expires_on is null or expires_on >= target_on))
      else exists (select 1 from public.training_records where employee_id = target_employee_id and lower(btrim(course_name)) = lower(requirement_row.required_name) and (expires_on is null or expires_on >= target_on)) end;
    requirements := requirements || jsonb_build_array(jsonb_build_object('label', requirement_row.label, 'met', has_record));
    if not has_record then missing := missing || jsonb_build_array(requirement_row.label); end if;
  end loop;
  return jsonb_build_object('yearsOfService', years, 'minimumYearsOfService', criterion_row.minimum_years_of_service, 'timeInGradeYears', grade_years, 'minimumTimeInGradeYears', criterion_row.minimum_time_in_grade_years, 'isReady', years >= criterion_row.minimum_years_of_service and rating_ok and pft_ok and jsonb_array_length(missing) = 0, 'missingRequirements', missing, 'requirements', requirements);
end;
$$;

revoke all on function public.record_physical_fitness_result(uuid, numeric, date, date, text), public.create_promotion_criterion(integer, integer, integer, jsonb), public.create_promotion_criterion(integer, integer, integer, jsonb, integer, integer, numeric, integer) from public, anon;
grant execute on function public.record_physical_fitness_result(uuid, numeric, date, date, text), public.create_promotion_criterion(integer, integer, integer, jsonb), public.create_promotion_criterion(integer, integer, integer, jsonb, integer, integer, numeric, integer) to authenticated, service_role;
