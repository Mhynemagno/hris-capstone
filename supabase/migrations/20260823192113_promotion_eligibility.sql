create table public.promotion_criteria (
  id uuid primary key default gen_random_uuid(),
  target_position_id integer not null unique references public.positions(id) on delete restrict,
  minimum_years_of_service integer not null check (minimum_years_of_service between 0 and 100),
  minimum_performance_rating smallint check (minimum_performance_rating between 1 and 5),
  is_active boolean not null default true,
  created_by_user_id uuid not null references public.profiles(id),
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promotion_criteria_requirements (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.promotion_criteria(id) on delete restrict,
  ordinal integer not null check (ordinal > 0),
  record_kind text not null check (record_kind in ('qualification', 'certification', 'training')),
  required_name text not null check (required_name = btrim(required_name) and char_length(required_name) between 1 and 200),
  label text not null check (label = btrim(label) and char_length(label) between 1 and 200),
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now(),
  unique (criterion_id, ordinal)
);

create table public.performance_ratings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  review_period_starts_on date not null,
  review_period_ends_on date not null,
  notes text check (notes is null or (notes = btrim(notes) and char_length(notes) <= 2000)),
  created_by_user_id uuid not null references public.profiles(id),
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_period_ends_on >= review_period_starts_on)
);

create table public.promotion_evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  target_position_id integer not null references public.positions(id) on delete restrict,
  criterion_id uuid not null references public.promotion_criteria(id) on delete restrict,
  evaluated_on date not null,
  criteria_snapshot jsonb not null check (jsonb_typeof(criteria_snapshot) = 'object'),
  years_of_service integer not null check (years_of_service >= 0),
  is_ready boolean not null,
  missing_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_requirements) = 'array'),
  recommendation text not null check (recommendation in ('recommended', 'not_recommended', 'deferred')),
  notes text check (notes is null or (notes = btrim(notes) and char_length(notes) <= 2000)),
  created_by_user_id uuid not null references public.profiles(id),
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promotion_evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.promotion_evaluations(id) on delete restrict,
  requirement_id uuid not null references public.promotion_criteria_requirements(id) on delete restrict,
  qualification_id uuid references public.qualifications(id) on delete restrict,
  certification_id uuid references public.certifications(id) on delete restrict,
  training_record_id uuid references public.training_records(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (num_nonnulls(qualification_id, certification_id, training_record_id) = 1),
  unique (evaluation_id, requirement_id)
);

create table public.employee_promotion_eligibility_summaries (
  employee_id uuid primary key references public.employees(id) on delete restrict,
  evaluation_id uuid not null unique references public.promotion_evaluations(id) on delete restrict,
  target_position_id integer not null references public.positions(id) on delete restrict,
  target_position_title text not null,
  calculated_at timestamptz not null,
  years_of_service integer not null check (years_of_service >= 0),
  is_ready boolean not null,
  missing_requirements jsonb not null check (jsonb_typeof(missing_requirements) = 'array'),
  updated_at timestamptz not null default now()
);

create index promotion_criteria_requirements_criterion_idx on public.promotion_criteria_requirements (criterion_id, ordinal);
create index performance_ratings_employee_period_idx on public.performance_ratings (employee_id, review_period_ends_on desc);
create index promotion_evaluations_employee_updated_idx on public.promotion_evaluations (employee_id, updated_at desc);
create index promotion_evaluations_position_readiness_updated_idx on public.promotion_evaluations (target_position_id, is_ready, updated_at desc);
create index promotion_evidence_evaluation_idx on public.promotion_evaluation_evidence (evaluation_id);
create index promotion_evidence_requirement_idx on public.promotion_evaluation_evidence (requirement_id);

alter table public.promotion_criteria enable row level security;
alter table public.promotion_criteria_requirements enable row level security;
alter table public.performance_ratings enable row level security;
alter table public.promotion_evaluations enable row level security;
alter table public.promotion_evaluation_evidence enable row level security;
alter table public.employee_promotion_eligibility_summaries enable row level security;

revoke all on public.promotion_criteria, public.promotion_criteria_requirements, public.performance_ratings, public.promotion_evaluations, public.promotion_evaluation_evidence, public.employee_promotion_eligibility_summaries from anon, authenticated;
grant select on public.promotion_criteria, public.promotion_criteria_requirements, public.performance_ratings, public.promotion_evaluations, public.promotion_evaluation_evidence, public.employee_promotion_eligibility_summaries to authenticated;

create policy promotion_criteria_select_hr on public.promotion_criteria for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy promotion_criteria_requirements_select_hr on public.promotion_criteria_requirements for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy performance_ratings_select_hr on public.performance_ratings for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy promotion_evaluations_select_hr on public.promotion_evaluations for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy promotion_evidence_select_hr on public.promotion_evaluation_evidence for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy promotion_summaries_select_own on public.employee_promotion_eligibility_summaries for select to authenticated using (
  exists (select 1 from public.employees employee where employee.id = employee_promotion_eligibility_summaries.employee_id and employee.profile_id = (select auth.uid()))
);

create or replace function private.create_promotion_criterion(target_position_id integer, target_minimum_years integer, target_minimum_rating integer, target_requirements jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); criterion_id uuid; item jsonb; ordinal_value integer := 0; kind_value text; name_value text; label_value text;
begin
  if target_minimum_years not between 0 and 100 or target_minimum_rating is not null and target_minimum_rating not between 1 and 5 or jsonb_typeof(target_requirements) <> 'array' then raise exception 'Promotion criteria are invalid.' using errcode = '22023'; end if;
  if not exists (select 1 from public.positions where id = target_position_id) then raise exception 'Target position was not found.' using errcode = 'P0001'; end if;
  insert into public.promotion_criteria (target_position_id, minimum_years_of_service, minimum_performance_rating, created_by_user_id, updated_by_user_id) values (target_position_id, target_minimum_years, target_minimum_rating, caller_id, caller_id) returning id into criterion_id;
  for item in select value from jsonb_array_elements(target_requirements) loop
    ordinal_value := ordinal_value + 1; kind_value := item ->> 'recordKind'; name_value := btrim(item ->> 'requiredName'); label_value := btrim(item ->> 'label');
    if kind_value not in ('qualification', 'certification', 'training') or name_value is null or name_value = '' or label_value is null or label_value = '' then raise exception 'Promotion requirement is invalid.' using errcode = '22023'; end if;
    insert into public.promotion_criteria_requirements (criterion_id, ordinal, record_kind, required_name, label, is_mandatory) values (criterion_id, ordinal_value, kind_value, name_value, label_value, coalesce((item ->> 'isMandatory')::boolean, true));
  end loop;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_criteria', criterion_id::text, 'created', jsonb_build_object('target_position_id', target_position_id));
  return criterion_id;
end;
$$;

create or replace function private.create_performance_rating(target_employee_id uuid, target_rating integer, target_starts_on date, target_ends_on date, target_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); rating_id uuid; clean_notes text := nullif(btrim(target_notes), '');
begin
  if target_rating not between 1 and 5 or target_ends_on < target_starts_on or clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Performance rating is invalid.' using errcode = '22023'; end if;
  if not exists (select 1 from public.employees where id = target_employee_id) then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  insert into public.performance_ratings (employee_id, rating, review_period_starts_on, review_period_ends_on, notes, created_by_user_id, updated_by_user_id) values (target_employee_id, target_rating, target_starts_on, target_ends_on, clean_notes, caller_id, caller_id) returning id into rating_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'performance_ratings', rating_id::text, 'created', jsonb_build_object('employee_id', target_employee_id));
  return rating_id;
end;
$$;

create or replace function private.create_promotion_evaluation(target_employee_id uuid, target_position_id integer, target_criterion_id uuid, target_evaluated_on date, target_recommendation text, target_notes text, target_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); employee_row public.employees%rowtype; criterion_row public.promotion_criteria%rowtype; evaluation_id uuid; requirement_row public.promotion_criteria_requirements%rowtype; missing jsonb := '[]'::jsonb; years integer; rating_value integer; rating_ok boolean; has_record boolean; item jsonb; requirement_id uuid; qualification_id uuid; certification_id uuid; training_id uuid; clean_notes text := nullif(btrim(target_notes), ''); position_title text;
begin
  if target_recommendation not in ('recommended', 'not_recommended', 'deferred') or jsonb_typeof(target_evidence) <> 'array' or clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Promotion evaluation is invalid.' using errcode = '22023'; end if;
  select * into employee_row from public.employees where id = target_employee_id for share; if not found then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id and is_active for share; if not found or criterion_row.target_position_id <> target_position_id then raise exception 'Promotion criteria are not active for the target position.' using errcode = 'P0001'; end if;
  select title into position_title from public.positions where id = target_position_id; if position_title is null then raise exception 'Target position was not found.' using errcode = 'P0001'; end if;
  years := greatest(0, extract(year from age(target_evaluated_on, employee_row.employment_started_on))::integer);
  select rating into rating_value from public.performance_ratings where employee_id = target_employee_id and review_period_ends_on <= target_evaluated_on order by review_period_ends_on desc, created_at desc limit 1;
  rating_ok := criterion_row.minimum_performance_rating is null or coalesce(rating_value, 0) >= criterion_row.minimum_performance_rating;
  for requirement_row in select * from public.promotion_criteria_requirements where criterion_id = criterion_row.id and is_mandatory order by ordinal loop
    has_record := case requirement_row.record_kind
      when 'qualification' then exists (select 1 from public.qualifications where employee_id = target_employee_id and lower(btrim(name)) = lower(requirement_row.required_name))
      when 'certification' then exists (select 1 from public.certifications where employee_id = target_employee_id and lower(btrim(name)) = lower(requirement_row.required_name) and (expires_on is null or expires_on >= target_evaluated_on))
      else exists (select 1 from public.training_records where employee_id = target_employee_id and lower(btrim(course_name)) = lower(requirement_row.required_name) and (expires_on is null or expires_on >= target_evaluated_on)) end;
    if not has_record then missing := missing || jsonb_build_array(requirement_row.label); end if;
  end loop;
  insert into public.promotion_evaluations (employee_id, target_position_id, criterion_id, evaluated_on, criteria_snapshot, years_of_service, is_ready, missing_requirements, recommendation, notes, created_by_user_id, updated_by_user_id)
  values (target_employee_id, target_position_id, criterion_row.id, target_evaluated_on, jsonb_build_object('minimumYearsOfService', criterion_row.minimum_years_of_service, 'minimumPerformanceRating', criterion_row.minimum_performance_rating, 'requirements', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'recordKind', record_kind, 'requiredName', required_name, 'label', label, 'isMandatory', is_mandatory) order by ordinal), '[]'::jsonb) from public.promotion_criteria_requirements where criterion_id = criterion_row.id)), years, years >= criterion_row.minimum_years_of_service and rating_ok and jsonb_array_length(missing) = 0, missing, target_recommendation, clean_notes, caller_id, caller_id) returning id into evaluation_id;
  for item in select value from jsonb_array_elements(target_evidence) loop
    requirement_id := (item ->> 'requirementId')::uuid; qualification_id := nullif(item ->> 'qualificationId', '')::uuid; certification_id := nullif(item ->> 'certificationId', '')::uuid; training_id := nullif(item ->> 'trainingRecordId', '')::uuid;
    if num_nonnulls(qualification_id, certification_id, training_id) <> 1 or not exists (select 1 from public.promotion_criteria_requirements where id = requirement_id and criterion_id = criterion_row.id) then raise exception 'Promotion evidence is invalid.' using errcode = '22023'; end if;
    if qualification_id is not null and not exists (select 1 from public.qualifications where id = qualification_id and employee_id = target_employee_id) or certification_id is not null and not exists (select 1 from public.certifications where id = certification_id and employee_id = target_employee_id) or training_id is not null and not exists (select 1 from public.training_records where id = training_id and employee_id = target_employee_id) then raise exception 'Promotion evidence does not belong to this employee.' using errcode = '22023'; end if;
    insert into public.promotion_evaluation_evidence (evaluation_id, requirement_id, qualification_id, certification_id, training_record_id) values (evaluation_id, requirement_id, qualification_id, certification_id, training_id);
  end loop;
  insert into public.employee_promotion_eligibility_summaries (employee_id, evaluation_id, target_position_id, target_position_title, calculated_at, years_of_service, is_ready, missing_requirements) select evaluation.employee_id, evaluation.id, evaluation.target_position_id, position_title, now(), evaluation.years_of_service, evaluation.is_ready, evaluation.missing_requirements from public.promotion_evaluations evaluation where evaluation.id = evaluation_id on conflict (employee_id) do update set evaluation_id = excluded.evaluation_id, target_position_id = excluded.target_position_id, target_position_title = excluded.target_position_title, calculated_at = excluded.calculated_at, years_of_service = excluded.years_of_service, is_ready = excluded.is_ready, missing_requirements = excluded.missing_requirements, updated_at = now();
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_evaluations', evaluation_id::text, 'created', jsonb_build_object('employee_id', target_employee_id, 'target_position_id', target_position_id));
  return evaluation_id;
end;
$$;

create or replace function public.create_promotion_criterion(target_position_id integer, target_minimum_years integer, target_minimum_rating integer, target_requirements jsonb) returns uuid language plpgsql security definer set search_path = '' as $$ begin return private.create_promotion_criterion(target_position_id, target_minimum_years, target_minimum_rating, target_requirements); end; $$;
create or replace function public.create_performance_rating(target_employee_id uuid, target_rating integer, target_starts_on date, target_ends_on date, target_notes text) returns uuid language plpgsql security definer set search_path = '' as $$ begin return private.create_performance_rating(target_employee_id, target_rating, target_starts_on, target_ends_on, target_notes); end; $$;
create or replace function public.create_promotion_evaluation(target_employee_id uuid, target_position_id integer, target_criterion_id uuid, target_evaluated_on date, target_recommendation text, target_notes text, target_evidence jsonb) returns uuid language plpgsql security definer set search_path = '' as $$ begin return private.create_promotion_evaluation(target_employee_id, target_position_id, target_criterion_id, target_evaluated_on, target_recommendation, target_notes, target_evidence); end; $$;

create or replace function private.update_promotion_criterion(target_criterion_id uuid, expected_updated_at timestamptz, target_position_id integer, target_minimum_years integer, target_minimum_rating integer, target_is_active boolean, target_requirements jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); criterion_row public.promotion_criteria%rowtype; item jsonb; ordinal_value integer := 0; kind_value text; name_value text; label_value text;
begin
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id for update;
  if not found then raise exception 'Promotion criteria were not found.' using errcode = 'P0001'; end if;
  if expected_updated_at is null or criterion_row.updated_at <> expected_updated_at then raise exception 'Promotion criteria changed. Refresh and try again.' using errcode = 'P0001'; end if;
  if target_minimum_years not between 0 and 100 or target_minimum_rating is not null and target_minimum_rating not between 1 and 5 or jsonb_typeof(target_requirements) <> 'array' or not exists (select 1 from public.positions where id = target_position_id) then raise exception 'Promotion criteria are invalid.' using errcode = '22023'; end if;
  if exists (select 1 from public.promotion_evaluation_evidence evidence join public.promotion_criteria_requirements requirement on requirement.id = evidence.requirement_id where requirement.criterion_id = criterion_row.id) then raise exception 'Criteria with linked evaluation evidence cannot replace requirements.' using errcode = 'P0001'; end if;
  delete from public.promotion_criteria_requirements where criterion_id = criterion_row.id;
  for item in select value from jsonb_array_elements(target_requirements) loop
    ordinal_value := ordinal_value + 1; kind_value := item ->> 'recordKind'; name_value := btrim(item ->> 'requiredName'); label_value := btrim(item ->> 'label');
    if kind_value not in ('qualification', 'certification', 'training') or name_value is null or name_value = '' or label_value is null or label_value = '' then raise exception 'Promotion requirement is invalid.' using errcode = '22023'; end if;
    insert into public.promotion_criteria_requirements (criterion_id, ordinal, record_kind, required_name, label, is_mandatory) values (criterion_row.id, ordinal_value, kind_value, name_value, label_value, coalesce((item ->> 'isMandatory')::boolean, true));
  end loop;
  update public.promotion_criteria set target_position_id = target_position_id, minimum_years_of_service = target_minimum_years, minimum_performance_rating = target_minimum_rating, is_active = target_is_active, updated_by_user_id = caller_id, updated_at = greatest(clock_timestamp(), criterion_row.updated_at + interval '1 microsecond') where id = criterion_row.id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_criteria', criterion_row.id::text, 'updated', '{}'::jsonb);
end;
$$;

create or replace function private.update_performance_rating(target_rating_id uuid, expected_updated_at timestamptz, target_rating integer, target_starts_on date, target_ends_on date, target_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); rating_row public.performance_ratings%rowtype; clean_notes text := nullif(btrim(target_notes), '');
begin
  select * into rating_row from public.performance_ratings where id = target_rating_id for update;
  if not found then raise exception 'Performance rating was not found.' using errcode = 'P0001'; end if;
  if expected_updated_at is null or rating_row.updated_at <> expected_updated_at then raise exception 'Performance rating changed. Refresh and try again.' using errcode = 'P0001'; end if;
  if target_rating not between 1 and 5 or target_ends_on < target_starts_on or clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Performance rating is invalid.' using errcode = '22023'; end if;
  update public.performance_ratings set rating = target_rating, review_period_starts_on = target_starts_on, review_period_ends_on = target_ends_on, notes = clean_notes, updated_by_user_id = caller_id, updated_at = greatest(clock_timestamp(), rating_row.updated_at + interval '1 microsecond') where id = rating_row.id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'performance_ratings', rating_row.id::text, 'updated', jsonb_build_object('employee_id', rating_row.employee_id));
end;
$$;

create or replace function private.update_promotion_evaluation(target_evaluation_id uuid, expected_updated_at timestamptz, target_evaluated_on date, target_recommendation text, target_notes text, target_evidence jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); evaluation_row public.promotion_evaluations%rowtype; item jsonb; requirement_id uuid; qualification_id uuid; certification_id uuid; training_id uuid; clean_notes text := nullif(btrim(target_notes), '');
begin
  select * into evaluation_row from public.promotion_evaluations where id = target_evaluation_id for update;
  if not found then raise exception 'Promotion evaluation was not found.' using errcode = 'P0001'; end if;
  if expected_updated_at is null or evaluation_row.updated_at <> expected_updated_at then raise exception 'Promotion evaluation changed. Refresh and try again.' using errcode = 'P0001'; end if;
  if target_evaluated_on <> evaluation_row.evaluated_on or target_recommendation not in ('recommended', 'not_recommended', 'deferred') or jsonb_typeof(target_evidence) <> 'array' or clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Promotion evaluation is invalid.' using errcode = '22023'; end if;
  delete from public.promotion_evaluation_evidence where evaluation_id = evaluation_row.id;
  for item in select value from jsonb_array_elements(target_evidence) loop
    requirement_id := (item ->> 'requirementId')::uuid; qualification_id := nullif(item ->> 'qualificationId', '')::uuid; certification_id := nullif(item ->> 'certificationId', '')::uuid; training_id := nullif(item ->> 'trainingRecordId', '')::uuid;
    if num_nonnulls(qualification_id, certification_id, training_id) <> 1 or not exists (select 1 from public.promotion_criteria_requirements where id = requirement_id and criterion_id = evaluation_row.criterion_id) then raise exception 'Promotion evidence is invalid.' using errcode = '22023'; end if;
    if qualification_id is not null and not exists (select 1 from public.qualifications where id = qualification_id and employee_id = evaluation_row.employee_id) or certification_id is not null and not exists (select 1 from public.certifications where id = certification_id and employee_id = evaluation_row.employee_id) or training_id is not null and not exists (select 1 from public.training_records where id = training_id and employee_id = evaluation_row.employee_id) then raise exception 'Promotion evidence does not belong to this employee.' using errcode = '22023'; end if;
    insert into public.promotion_evaluation_evidence (evaluation_id, requirement_id, qualification_id, certification_id, training_record_id) values (evaluation_row.id, requirement_id, qualification_id, certification_id, training_id);
  end loop;
  update public.promotion_evaluations set recommendation = target_recommendation, notes = clean_notes, updated_by_user_id = caller_id, updated_at = greatest(clock_timestamp(), evaluation_row.updated_at + interval '1 microsecond') where id = evaluation_row.id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_evaluations', evaluation_row.id::text, 'updated', jsonb_build_object('employee_id', evaluation_row.employee_id));
end;
$$;

create or replace function public.update_promotion_criterion(target_criterion_id uuid, expected_updated_at timestamptz, target_position_id integer, target_minimum_years integer, target_minimum_rating integer, target_is_active boolean, target_requirements jsonb) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.update_promotion_criterion(target_criterion_id, expected_updated_at, target_position_id, target_minimum_years, target_minimum_rating, target_is_active, target_requirements); end; $$;
create or replace function public.update_performance_rating(target_rating_id uuid, expected_updated_at timestamptz, target_rating integer, target_starts_on date, target_ends_on date, target_notes text) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.update_performance_rating(target_rating_id, expected_updated_at, target_rating, target_starts_on, target_ends_on, target_notes); end; $$;
create or replace function public.update_promotion_evaluation(target_evaluation_id uuid, expected_updated_at timestamptz, target_evaluated_on date, target_recommendation text, target_notes text, target_evidence jsonb) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.update_promotion_evaluation(target_evaluation_id, expected_updated_at, target_evaluated_on, target_recommendation, target_notes, target_evidence); end; $$;

revoke all on function private.create_promotion_criterion(integer, integer, integer, jsonb), private.create_performance_rating(uuid, integer, date, date, text), private.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb), private.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb), private.update_performance_rating(uuid, timestamptz, integer, date, date, text), private.update_promotion_evaluation(uuid, timestamptz, date, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_promotion_criterion(integer, integer, integer, jsonb), public.create_performance_rating(uuid, integer, date, date, text), public.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb), public.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb), public.update_performance_rating(uuid, timestamptz, integer, date, date, text), public.update_promotion_evaluation(uuid, timestamptz, date, text, text, jsonb) from public, anon;
grant execute on function public.create_promotion_criterion(integer, integer, integer, jsonb), public.create_performance_rating(uuid, integer, date, date, text), public.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb), public.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb), public.update_performance_rating(uuid, timestamptz, integer, date, date, text), public.update_promotion_evaluation(uuid, timestamptz, date, text, text, jsonb) to authenticated;
