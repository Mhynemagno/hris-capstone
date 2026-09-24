-- Positions become Ranks: one police rank catalogue shared by every department (client feedback,
-- 2026-09-24). Also renames sex -> gender, limits employment status to active / on_leave, removes
-- department and rank deletion, and lets applicants keep reading the job they applied for.
-- Runs before the demo-data reset, so existing rows only need to survive the renames.

-- Objects whose signatures change are dropped and recreated below (PL/pgSQL bodies are not
-- rewritten by column renames, so every dependent function is redefined explicitly).
drop function if exists public.delete_department(bigint);
drop function if exists public.delete_position(bigint);
drop function if exists public.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb);
drop function if exists private.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb);
drop function if exists public.create_promotion_criterion(integer, integer, integer, jsonb);
drop function if exists private.create_promotion_criterion(integer, integer, integer, jsonb);
drop function if exists public.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb);
drop function if exists private.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb);
drop function if exists public.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb);
drop function if exists private.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb);

-- Ranks table
alter table public.positions rename to ranks;
alter table public.ranks drop constraint positions_department_id_title_key;
drop index if exists public.positions_department_id_idx;
drop index if exists public.positions_code_unique_idx;
alter table public.ranks drop column department_id;
alter table public.ranks drop constraint if exists positions_description_length_check;
alter table public.ranks drop column description;
alter table public.ranks drop constraint if exists positions_code_format_check;
alter table public.ranks rename column title to name;
-- Legacy titles were unique only per department and codes allowed 32 characters, so the global
-- name uniqueness and the 16-character code rule are added by the reset, once legacy rows are gone.
update public.ranks set code = coalesce(nullif(btrim(code), ''), 'LEGACY-' || id);
alter table public.ranks
  alter column code set not null,
  add column sort_order integer;
update public.ranks set sort_order = 1000 + id;
alter table public.ranks
  alter column sort_order set not null,
  add constraint ranks_code_key unique (code),
  add constraint ranks_sort_order_key unique (sort_order),
  add constraint ranks_name_check check (char_length(btrim(name)) between 2 and 160),
  add constraint ranks_sort_order_check check (sort_order between 1 and 10000);
alter table public.ranks rename constraint positions_pkey to ranks_pkey;
alter trigger positions_touch_updated_at on public.ranks rename to ranks_touch_updated_at;
alter trigger positions_write_audit_log on public.ranks rename to ranks_write_audit_log;
alter policy positions_select_authenticated on public.ranks rename to ranks_select_authenticated;
alter policy positions_insert_admin on public.ranks rename to ranks_insert_admin;
alter policy positions_update_admin on public.ranks rename to ranks_update_admin;

-- Departments and ranks are deactivated, never deleted.
revoke delete on public.ranks from authenticated, anon;
revoke delete on public.departments from authenticated, anon;

-- Referencing columns
alter table public.employees rename column position_id to rank_id;
alter table public.employees rename constraint employees_position_id_fkey to employees_rank_id_fkey;
alter table public.service_history rename column position_id to rank_id;
alter table public.service_history rename constraint service_history_position_id_fkey to service_history_rank_id_fkey;
alter table public.job_openings rename column position_id to rank_id;
alter table public.job_openings rename constraint job_openings_position_id_fkey to job_openings_rank_id_fkey;
alter index public.job_openings_position_id_idx rename to job_openings_rank_id_idx;
alter table public.promotion_criteria rename column target_position_id to target_rank_id;
alter table public.promotion_criteria rename constraint promotion_criteria_target_position_id_fkey to promotion_criteria_target_rank_id_fkey;
alter table public.promotion_criteria rename constraint promotion_criteria_target_position_id_key to promotion_criteria_target_rank_id_key;
alter table public.promotion_evaluations rename column target_position_id to target_rank_id;
alter table public.promotion_evaluations rename constraint promotion_evaluations_target_position_id_fkey to promotion_evaluations_target_rank_id_fkey;
alter index public.promotion_evaluations_position_readiness_updated_idx rename to promotion_evaluations_rank_readiness_updated_idx;
alter table public.employee_promotion_eligibility_summaries rename column target_position_id to target_rank_id;
alter table public.employee_promotion_eligibility_summaries rename column target_position_title to target_rank_name;
alter table public.employee_promotion_eligibility_summaries
  rename constraint employee_promotion_eligibility_summarie_target_position_id_fkey to employee_promotion_eligibility_summaries_target_rank_id_fkey;
alter view reporting.current_workforce rename column position_id to rank_id;

-- The free-text rank is replaced by rank_id.
alter table public.employees drop column rank;

-- Gender
alter table public.employees rename column sex to gender;
alter table public.applicants rename column sex to gender;
alter table public.employees rename constraint employees_sex_check to employees_gender_check;
alter table public.applicants rename constraint applicants_sex_check to applicants_gender_check;

-- Employment status: Active or On leave only
update public.employees set employment_status = 'active' where employment_status not in ('active', 'on_leave');
alter table public.employees drop constraint employees_employment_status_check;
alter table public.employees add constraint employees_employment_status_check
  check (employment_status in ('active', 'on_leave'));

-- AI analysis timeout failure code (used by the sweeper in 20260924112000)
alter table public.application_ai_scores drop constraint application_ai_scores_failure_code_check;
alter table public.application_ai_scores add constraint application_ai_scores_failure_code_check
  check (failure_code is null or failure_code in
    ('configuration_unavailable', 'provider_unavailable', 'provider_invalid_response', 'persistence_failed', 'timed_out'));

-- Applicants keep seeing the job they applied for after it closes or is withdrawn.
create policy job_openings_select_own_application on public.job_openings
  for select to authenticated
  using (exists (
    select 1 from public.applications application
    join public.applicants applicant on applicant.id = application.applicant_id
    where application.job_opening_id = job_openings.id
      and applicant.profile_id = (select auth.uid())
  ));
create policy job_criteria_select_own_application on public.job_qualification_criteria
  for select to authenticated
  using (exists (
    select 1 from public.applications application
    join public.applicants applicant on applicant.id = application.applicant_id
    where application.job_opening_id = job_qualification_criteria.job_opening_id
      and applicant.profile_id = (select auth.uid())
  ));

-- Functions rewritten against ranks / rank_id / gender

CREATE OR REPLACE FUNCTION private.create_promotion_criterion(target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_requirements jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid := private.require_active_hr(); criterion_id uuid; item jsonb; ordinal_value integer := 0; kind_value text; name_value text; label_value text;
begin
  if target_minimum_years not between 0 and 100 or target_minimum_rating is not null and target_minimum_rating not between 1 and 5 or jsonb_typeof(target_requirements) <> 'array' then raise exception 'Promotion criteria are invalid.' using errcode = '22023'; end if;
  if not exists (select 1 from public.ranks where id = target_rank_id) then raise exception 'Target rank was not found.' using errcode = 'P0001'; end if;
  insert into public.promotion_criteria (target_rank_id, minimum_years_of_service, minimum_performance_rating, created_by_user_id, updated_by_user_id) values (target_rank_id, target_minimum_years, target_minimum_rating, caller_id, caller_id) returning id into criterion_id;
  for item in select value from jsonb_array_elements(target_requirements) loop
    ordinal_value := ordinal_value + 1; kind_value := item ->> 'recordKind'; name_value := btrim(item ->> 'requiredName'); label_value := btrim(item ->> 'label');
    if kind_value not in ('qualification', 'certification', 'training') or name_value is null or name_value = '' or label_value is null or label_value = '' then raise exception 'Promotion requirement is invalid.' using errcode = '22023'; end if;
    insert into public.promotion_criteria_requirements (criterion_id, ordinal, record_kind, required_name, label, is_mandatory) values (criterion_id, ordinal_value, kind_value, name_value, label_value, coalesce((item ->> 'isMandatory')::boolean, true));
  end loop;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_criteria', criterion_id::text, 'created', jsonb_build_object('target_rank_id', target_rank_id));
  return criterion_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.create_promotion_evaluation(target_employee_id uuid, target_rank_id integer, target_criterion_id uuid, target_evaluated_on date, target_recommendation text, target_notes text, target_evidence jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid := private.require_active_hr(); employee_row public.employees%rowtype; criterion_row public.promotion_criteria%rowtype; evaluation_id uuid; requirement_row public.promotion_criteria_requirements%rowtype; missing jsonb := '[]'::jsonb; years integer; rating_value integer; rating_ok boolean; has_record boolean; item jsonb; requirement_id uuid; qualification_id uuid; certification_id uuid; training_id uuid; clean_notes text := nullif(btrim(target_notes), ''); rank_name text;
begin
  if target_recommendation not in ('recommended', 'not_recommended', 'deferred') or jsonb_typeof(target_evidence) <> 'array' or clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Promotion evaluation is invalid.' using errcode = '22023'; end if;
  select * into employee_row from public.employees where id = target_employee_id for share; if not found then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id and is_active for share; if not found or criterion_row.target_rank_id <> target_rank_id then raise exception 'Promotion criteria are not active for the target rank.' using errcode = 'P0001'; end if;
  select name into rank_name from public.ranks where id = target_rank_id; if rank_name is null then raise exception 'Target rank was not found.' using errcode = 'P0001'; end if;
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
  insert into public.promotion_evaluations (employee_id, target_rank_id, criterion_id, evaluated_on, criteria_snapshot, years_of_service, is_ready, missing_requirements, recommendation, notes, created_by_user_id, updated_by_user_id)
  values (target_employee_id, target_rank_id, criterion_row.id, target_evaluated_on, jsonb_build_object('minimumYearsOfService', criterion_row.minimum_years_of_service, 'minimumPerformanceRating', criterion_row.minimum_performance_rating, 'requirements', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'recordKind', record_kind, 'requiredName', required_name, 'label', label, 'isMandatory', is_mandatory) order by ordinal), '[]'::jsonb) from public.promotion_criteria_requirements where criterion_id = criterion_row.id)), years, years >= criterion_row.minimum_years_of_service and rating_ok and jsonb_array_length(missing) = 0, missing, target_recommendation, clean_notes, caller_id, caller_id) returning id into evaluation_id;
  for item in select value from jsonb_array_elements(target_evidence) loop
    requirement_id := (item ->> 'requirementId')::uuid; qualification_id := nullif(item ->> 'qualificationId', '')::uuid; certification_id := nullif(item ->> 'certificationId', '')::uuid; training_id := nullif(item ->> 'trainingRecordId', '')::uuid;
    if num_nonnulls(qualification_id, certification_id, training_id) <> 1 or not exists (select 1 from public.promotion_criteria_requirements where id = requirement_id and criterion_id = criterion_row.id) then raise exception 'Promotion evidence is invalid.' using errcode = '22023'; end if;
    if qualification_id is not null and not exists (select 1 from public.qualifications where id = qualification_id and employee_id = target_employee_id) or certification_id is not null and not exists (select 1 from public.certifications where id = certification_id and employee_id = target_employee_id) or training_id is not null and not exists (select 1 from public.training_records where id = training_id and employee_id = target_employee_id) then raise exception 'Promotion evidence does not belong to this employee.' using errcode = '22023'; end if;
    insert into public.promotion_evaluation_evidence (evaluation_id, requirement_id, qualification_id, certification_id, training_record_id) values (evaluation_id, requirement_id, qualification_id, certification_id, training_id);
  end loop;
  insert into public.employee_promotion_eligibility_summaries (employee_id, evaluation_id, target_rank_id, target_rank_name, calculated_at, years_of_service, is_ready, missing_requirements) select evaluation.employee_id, evaluation.id, evaluation.target_rank_id, rank_name, now(), evaluation.years_of_service, evaluation.is_ready, evaluation.missing_requirements from public.promotion_evaluations evaluation where evaluation.id = evaluation_id on conflict (employee_id) do update set evaluation_id = excluded.evaluation_id, target_rank_id = excluded.target_rank_id, target_rank_name = excluded.target_rank_name, calculated_at = excluded.calculated_at, years_of_service = excluded.years_of_service, is_ready = excluded.is_ready, missing_requirements = excluded.missing_requirements, updated_at = now();
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_evaluations', evaluation_id::text, 'created', jsonb_build_object('employee_id', target_employee_id, 'target_rank_id', target_rank_id));
  return evaluation_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.deletion_impact(entity_type text, entity_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid;
  record_label text;
  blockers jsonb := '[]'::jsonb;
  removes jsonb := '[]'::jsonb;
  reasons text[] := '{}';
  alternative text;
  target_uuid uuid;
  target_bigint bigint;
  target_role public.app_role;
  target_active boolean;
  job_status text;
  requirement_count bigint;
begin
  case entity_type
    when 'leave_type' then
      caller_id := private.require_active_hr();
      target_uuid := entity_id::uuid;
      select name into record_label from public.leave_types where id = target_uuid;
      if record_label is null then raise exception 'Leave type was not found.' using errcode = 'P0001'; end if;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.leave_types'::regclass, entity_id, true) refs;
      alternative := 'Deactivate the leave type so employees can no longer choose it; past requests keep their type.';

    when 'promotion_criterion' then
      caller_id := private.require_active_hr();
      target_uuid := entity_id::uuid;
      select rank.name into record_label
      from public.promotion_criteria criterion
      join public.ranks rank on rank.id = criterion.target_rank_id
      where criterion.id = target_uuid;
      if record_label is null then raise exception 'Promotion criterion was not found.' using errcode = 'P0001'; end if;
      record_label := 'Promotion criteria for ' || record_label;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.promotion_criteria'::regclass, entity_id, true, array['promotion_criteria_requirements']) refs;
      select count(*) into requirement_count from public.promotion_criteria_requirements where criterion_id = target_uuid;
      if requirement_count > 0 then
        removes := removes || jsonb_build_object('label', 'required credentials', 'count', requirement_count);
      end if;
      alternative := 'Deactivate the criteria so they are no longer used for new evaluations; past evaluations stay intact.';

    when 'job_opening' then
      caller_id := private.require_active_hr();
      target_bigint := entity_id::bigint;
      select title, status into record_label, job_status from public.job_openings where id = target_bigint;
      if record_label is null then raise exception 'Job opening was not found.' using errcode = 'P0001'; end if;
      if job_status <> 'draft' then
        reasons := array_append(reasons, 'Only draft openings can be deleted; published or closed openings are part of the recruitment record.'::text);
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.job_openings'::regclass, entity_id, true) refs;
      select count(*) into requirement_count from public.job_qualification_criteria where job_opening_id = target_bigint;
      if requirement_count > 0 then
        removes := removes || jsonb_build_object('label', 'qualification criteria', 'count', requirement_count);
      end if;
      alternative := 'Withdraw the opening to close it to applicants while keeping its applications and history.';

    when 'managed_user' then
      caller_id := private.require_active_admin();
      target_uuid := entity_id::uuid;
      select coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Account'), user_role.role, profile.is_active
        into record_label, target_role, target_active
      from public.profiles profile
      left join public.user_roles user_role on user_role.user_id = profile.id
      where profile.id = target_uuid;
      if record_label is null then raise exception 'Managed account was not found.' using errcode = 'P0001'; end if;
      if target_uuid = caller_id then
        reasons := array_append(reasons, 'You cannot delete your own account.'::text);
      end if;
      if target_role = 'system_administrator'::public.app_role and target_active and (
        select count(*) from public.user_roles user_role
        join public.profiles profile on profile.id = user_role.user_id
        where user_role.role = 'system_administrator'::public.app_role and profile.is_active
      ) <= 1 then
        reasons := array_append(reasons, 'At least one active system administrator is required.'::text);
      end if;
      -- Records the person created or decided, plus a linked personnel record
      -- and any job applications (reached through their applicant profile).
      with refs as (
        select refs.label, refs.row_count from private.reference_counts('public.profiles'::regclass, entity_id, false) refs
        union all
        select refs.label, refs.row_count from private.reference_counts('auth.users'::regclass, entity_id, false) refs
        union all
        select 'linked personnel record', count(*) from public.employees where profile_id = target_uuid having count(*) > 0
        union all
        select refs.label, refs.row_count
        from public.applicants applicant
        cross join lateral private.reference_counts('public.applicants'::regclass, applicant.id::text, false) refs
        where applicant.profile_id = target_uuid
      )
      select coalesce(jsonb_agg(jsonb_build_object('label', grouped.label, 'count', grouped.total) order by grouped.label), '[]')
        into blockers
      from (select refs.label, sum(refs.row_count)::bigint as total from refs group by refs.label) grouped;
      select coalesce(jsonb_agg(item), '[]') into removes from (
        select jsonb_build_object('label', 'notifications', 'count', count(*)) as item
        from public.notifications where recipient_user_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'applicant profile', 'count', count(*))
        from public.applicants where profile_id = target_uuid having count(*) > 0
      ) removed;
      alternative := 'Deactivate the account to block sign-in while keeping everything the person created or decided.';

    when 'notification' then
      caller_id := (select auth.uid());
      target_uuid := entity_id::uuid;
      select title into record_label from public.notifications
      where id = target_uuid and recipient_user_id = caller_id;
      if caller_id is null or record_label is null then raise exception 'Notification was not found.' using errcode = 'P0001'; end if;
      alternative := 'Mark the notification as read instead.';

    else
      raise exception 'Deletion is not supported for this record type.' using errcode = '22023';
  end case;

  return jsonb_build_object(
    'entityType', entity_type,
    'entityId', entity_id,
    'label', record_label,
    'canDelete', jsonb_array_length(blockers) = 0 and cardinality(reasons) = 0,
    'blockers', blockers,
    'reasons', to_jsonb(reasons),
    'removes', removes,
    'alternative', alternative
  );
exception
  when invalid_text_representation then
    raise exception 'The record identifier is not valid.' using errcode = '22023';
end;
$function$
;

CREATE OR REPLACE FUNCTION private.get_hr_dashboard_summary(target_starts_on date, target_ends_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on);

  return jsonb_build_object(
    'generatedAt', now(),
    'range', jsonb_build_object('startsOn', target_starts_on, 'endsOn', target_ends_on),
    'metrics', jsonb_build_object(
      'activeWorkforce', (select count(*) from reporting.current_workforce where employment_status = 'active'),
      'activeDeployments', (select count(*) from public.deployments where status = 'active'),
      'recruitmentApplications', (select count(*) from public.applications where submitted_at::date between target_starts_on and target_ends_on),
      'attendanceExceptions', (select count(*) from public.attendance_logs where attendance_date between target_starts_on and target_ends_on and status in ('late', 'absent', 'incomplete')),
      'pendingLeave', (select count(*) from public.leave_requests where status = 'pending'),
      'promotionReady', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and is_ready),
      'trainingNeeds', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and jsonb_array_length(missing_requirements) > 0)
    ),
    'breakdowns', jsonb_build_object(
      'recruitmentPipeline', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.applications where submitted_at::date between target_starts_on and target_ends_on group by status) pipeline), '[]'::jsonb),
      'deploymentStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.deployments group by status) deployment), '[]'::jsonb),
      'attendanceStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.attendance_logs where attendance_date between target_starts_on and target_ends_on group by status) attendance), '[]'::jsonb),
      'leaveStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on group by status) leave_request), '[]'::jsonb)
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.get_hr_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result jsonb;
  page_offset integer := (target_page - 1) * target_page_size;
begin
  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on, target_page, target_page_size);

  if target_report_key = 'applicant-tracking' then
    with filtered as (
      select application.id, applicant.first_name, applicant.last_name, opening.title, department.name as department_name, application.status, application.submitted_at
      from public.applications application join public.applicants applicant on applicant.id = application.applicant_id join public.job_openings opening on opening.id = application.job_opening_id left join public.departments department on department.id = opening.department_id
      where application.submitted_at::date between target_starts_on and target_ends_on and (target_department_id is null or opening.department_id = target_department_id) and (target_status is null or application.status = target_status)
    ), paged as (select * from filtered order by submitted_at desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Applicant tracking', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','applicationId','label','Application ID'), jsonb_build_object('key','applicant','label','Applicant'), jsonb_build_object('key','jobTitle','label','Job opening'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','submittedOn','label','Submitted')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('applicationId', id, 'applicant', concat_ws(' ', first_name, last_name), 'jobTitle', title, 'department', department_name, 'status', status, 'submittedOn', submitted_at::date) order by submitted_at desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'hiring-decisions' then
    with filtered as (
      select application.id, applicant.first_name, applicant.last_name, opening.title, department.name as department_name, application.status, application.updated_at
      from public.applications application join public.applicants applicant on applicant.id = application.applicant_id join public.job_openings opening on opening.id = application.job_opening_id left join public.departments department on department.id = opening.department_id
      where application.updated_at::date between target_starts_on and target_ends_on and application.status in ('Hired', 'Not Selected') and (target_department_id is null or opening.department_id = target_department_id) and (target_status is null or application.status = target_status)
    ), paged as (select * from filtered order by updated_at desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Hiring decisions', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','applicationId','label','Application ID'), jsonb_build_object('key','applicant','label','Applicant'), jsonb_build_object('key','jobTitle','label','Job opening'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','decision','label','Decision'), jsonb_build_object('key','decidedOn','label','Decided')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('applicationId', id, 'applicant', concat_ws(' ', first_name, last_name), 'jobTitle', title, 'department', department_name, 'decision', status, 'decidedOn', updated_at::date) order by updated_at desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'employee-performance' then
    with filtered as (
      select employee.id, employee.employee_number, employee.first_name, employee.last_name, department.name as department_name, rank.name as rank_name, employee.employment_status, rating.rating, rating.review_period_ends_on
      from public.employees employee left join public.departments department on department.id = employee.department_id left join public.ranks rank on rank.id = employee.rank_id left join lateral (select performance.rating, performance.review_period_ends_on from public.performance_ratings performance where performance.employee_id = employee.id and performance.review_period_ends_on between target_starts_on and target_ends_on order by performance.review_period_ends_on desc limit 1) rating on true
      where (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or employee.employment_status = target_status)
    ), paged as (select * from filtered order by employee_number limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Employee performance', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','rank','label','Rank'), jsonb_build_object('key','employmentStatus','label','Employment status'), jsonb_build_object('key','latestRating','label','Latest rating')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', concat_ws(' ', first_name, last_name), 'department', department_name, 'rank', rank_name, 'employmentStatus', employment_status, 'latestRating', rating) order by employee_number) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'deployments' then
    with filtered as (
      select deployment.id, employee.employee_number, employee.first_name, employee.last_name, department.name as department_name, deployment.assignment_role, deployment.location, deployment.unit, deployment.project, deployment.status, deployment.starts_on, deployment.ends_on
      from public.deployments deployment join public.employees employee on employee.id = deployment.employee_id left join public.departments department on department.id = employee.department_id
      where deployment.starts_on <= target_ends_on and (deployment.ends_on is null or deployment.ends_on >= target_starts_on) and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or deployment.status = target_status)
    ), paged as (select * from filtered order by starts_on desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Deployments', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','assignmentRole','label','Assignment role'), jsonb_build_object('key','destination','label','Destination'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','startsOn','label','Starts'), jsonb_build_object('key','endsOn','label','Ends')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', concat_ws(' ', first_name, last_name), 'department', department_name, 'assignmentRole', assignment_role, 'destination', concat_ws(' · ', location, unit, project), 'status', status, 'startsOn', starts_on, 'endsOn', ends_on) order by starts_on desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'attendance-leave' then
    with filtered as (
      select attendance.employee_id, employee.employee_number, concat_ws(' ', employee.first_name, employee.last_name) as employee_name, employee.department_id, department.name as department_name, 'Attendance'::text as record_type, attendance.status, attendance.attendance_date as record_date from public.attendance_logs attendance join public.employees employee on employee.id = attendance.employee_id left join public.departments department on department.id = employee.department_id where attendance.attendance_date between target_starts_on and target_ends_on
      union all
      select leave_request.employee_id, employee.employee_number, concat_ws(' ', employee.first_name, employee.last_name), employee.department_id, department.name, 'Leave'::text, leave_request.status, leave_request.starts_on from public.leave_requests leave_request join public.employees employee on employee.id = leave_request.employee_id left join public.departments department on department.id = employee.department_id where leave_request.starts_on between target_starts_on and target_ends_on
    ), scoped as (select * from filtered where (target_department_id is null or department_id = target_department_id) and (target_status is null or status = target_status)), paged as (select * from scoped order by record_date desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Attendance and leave', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','recordType','label','Record type'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','date','label','Date')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', employee_name, 'department', department_name, 'recordType', record_type, 'status', status, 'date', record_date) order by record_date desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from scoped), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'promotion-training-needs' then
    with filtered as (
      select evaluation.id, employee.employee_number, employee.first_name, employee.last_name, department.name as department_name, rank.name as rank_name, evaluation.is_ready, evaluation.recommendation, evaluation.missing_requirements, evaluation.evaluated_on from public.promotion_evaluations evaluation join public.employees employee on employee.id = evaluation.employee_id left join public.departments department on department.id = employee.department_id join public.ranks rank on rank.id = evaluation.target_rank_id where evaluation.evaluated_on between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or evaluation.recommendation = target_status)
    ), paged as (select * from filtered order by evaluated_on desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Promotion and training needs', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','targetRank','label','Target rank'), jsonb_build_object('key','ready','label','Ready'), jsonb_build_object('key','recommendation','label','Recommendation'), jsonb_build_object('key','missingRequirements','label','Missing requirements')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', concat_ws(' ', first_name, last_name), 'department', department_name, 'targetRank', rank_name, 'ready', is_ready, 'recommendation', recommendation, 'missingRequirements', (select string_agg(value, '; ') from jsonb_array_elements_text(missing_requirements) as requirement(value))) order by evaluated_on desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  else
    raise exception 'Unknown report key.' using errcode = '22023';
  end if;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.get_management_dashboard_summary(target_starts_on date, target_ends_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.require_active_reporting_role(array['management'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on);

  return jsonb_build_object(
    'generatedAt', now(),
    'range', jsonb_build_object('startsOn', target_starts_on, 'endsOn', target_ends_on),
    'metrics', jsonb_build_object(
      'activeWorkforce', (select count(*) from reporting.current_workforce where employment_status = 'active'),
      'activeDeployments', (select count(*) from public.deployments where status = 'active'),
      'recruitmentApplications', (select count(*) from public.applications where submitted_at::date between target_starts_on and target_ends_on),
      'attendanceExceptions', (select count(*) from public.attendance_logs where attendance_date between target_starts_on and target_ends_on and status in ('late', 'absent', 'incomplete')),
      'pendingLeave', (select count(*) from public.leave_requests where status = 'pending'),
      'promotionReady', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and is_ready),
      'trainingNeeds', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and jsonb_array_length(missing_requirements) > 0)
    ),
    'breakdowns', jsonb_build_object(
      'workforceByDepartment', coalesce((select jsonb_agg(jsonb_build_object('label', department_name, 'count', total) order by department_name) from (select coalesce(department.name, 'Unassigned') as department_name, count(*) as total from reporting.current_workforce workforce left join public.departments department on department.id = workforce.department_id where workforce.employment_status = 'active' group by department_name) workforce_department), '[]'::jsonb),
      'recruitmentPipeline', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.applications where submitted_at::date between target_starts_on and target_ends_on group by status) pipeline), '[]'::jsonb),
      'deploymentStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.deployments group by status) deployment), '[]'::jsonb),
      'attendanceLeaveExceptions', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', total) order by label) from (select status as label, count(*) as total from public.attendance_logs where attendance_date between target_starts_on and target_ends_on and status in ('late', 'absent', 'incomplete') group by status union all select status as label, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on and status = 'pending' group by status) exception_counts), '[]'::jsonb)
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.get_management_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result jsonb;
  page_offset integer := (target_page - 1) * target_page_size;
begin
  perform private.require_active_reporting_role(array['management'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on, target_page, target_page_size);

  if target_report_key in ('applicant-tracking', 'hiring-decisions') then
    with filtered as (select application.status, count(*) as total from public.applications application join public.job_openings opening on opening.id = application.job_opening_id where application.submitted_at::date between target_starts_on and target_ends_on and (target_department_id is null or opening.department_id = target_department_id) and (target_status is null or application.status = target_status) and (target_report_key <> 'hiring-decisions' or application.status in ('Hired', 'Not Selected')) group by application.status), paged as (select * from filtered order by status limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', case when target_report_key = 'applicant-tracking' then 'Applicant tracking summary' else 'Hiring decisions summary' end, 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','count','label','Applications')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', total) order by status) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'employee-performance' then
    with filtered as (select coalesce(department.name, 'Unassigned') as department_name, count(employee.id) as employee_count, avg(rating.rating) as average_rating from public.employees employee left join public.departments department on department.id = employee.department_id left join lateral (select performance.rating from public.performance_ratings performance where performance.employee_id = employee.id and performance.review_period_ends_on between target_starts_on and target_ends_on order by performance.review_period_ends_on desc limit 1) rating on true where (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or employee.employment_status = target_status) group by department_name), paged as (select * from filtered order by department_name limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Employee performance summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','employeeCount','label','Employees'), jsonb_build_object('key','averageRating','label','Average rating')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('department', department_name, 'employeeCount', employee_count, 'averageRating', average_rating) order by department_name) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'deployments' then
    with filtered as (select coalesce(department.name, 'Unassigned') as department_name, deployment.status, count(*) as total from public.deployments deployment join public.employees employee on employee.id = deployment.employee_id left join public.departments department on department.id = employee.department_id where deployment.starts_on <= target_ends_on and (deployment.ends_on is null or deployment.ends_on >= target_starts_on) and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or deployment.status = target_status) group by department_name, deployment.status), paged as (select * from filtered order by department_name, status limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Deployment summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','count','label','Deployments')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('department', department_name, 'status', status, 'count', total) order by department_name, status) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'attendance-leave' then
    with filtered as (select 'Attendance'::text as record_type, attendance.status, count(*) as total from public.attendance_logs attendance join public.employees employee on employee.id = attendance.employee_id where attendance.attendance_date between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or attendance.status = target_status) group by attendance.status union all select 'Leave'::text, leave_request.status, count(*) from public.leave_requests leave_request join public.employees employee on employee.id = leave_request.employee_id where leave_request.starts_on between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or leave_request.status = target_status) group by leave_request.status), paged as (select * from filtered order by record_type, status limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Attendance and leave summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','recordType','label','Record type'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','count','label','Records')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('recordType', record_type, 'status', status, 'count', total) order by record_type, status) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'promotion-training-needs' then
    with filtered as (select coalesce(department.name, 'Unassigned') as department_name, evaluation.recommendation, evaluation.is_ready, count(*) as total from public.promotion_evaluations evaluation join public.employees employee on employee.id = evaluation.employee_id left join public.departments department on department.id = employee.department_id where evaluation.evaluated_on between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or evaluation.recommendation = target_status) group by department_name, evaluation.recommendation, evaluation.is_ready), paged as (select * from filtered order by department_name, recommendation limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Promotion and training needs summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','recommendation','label','Recommendation'), jsonb_build_object('key','ready','label','Ready'), jsonb_build_object('key','count','label','Evaluations')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('department', department_name, 'recommendation', recommendation, 'ready', is_ready, 'count', total) order by department_name, recommendation) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  else
    raise exception 'Unknown report key.' using errcode = '22023';
  end if;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.hire_application(target_application_id uuid, target_badge_number text, decision_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  applicant_row public.applicants%rowtype;
  employee_profile public.profiles%rowtype;
  patrol_rank public.ranks%rowtype;
  new_employee_id uuid;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then raise exception 'HR access is required.' using errcode = '42501'; end if;
  if target_badge_number is null or char_length(btrim(target_badge_number)) not between 3 and 32 then raise exception 'Enter a valid Badge Number.' using errcode = '22023'; end if;
  select * into application_row from public.applications where id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status not in ('Shortlisted', 'Interview') then raise exception 'Only shortlisted or interviewed applications can be hired.' using errcode = '22023'; end if;
  select * into applicant_row from public.applicants where id = application_row.applicant_id;
  select * into employee_profile from public.profiles where id = applicant_row.profile_id;
  select * into patrol_rank from public.ranks where code = 'Pat' and is_active;
  if patrol_rank.id is null then raise exception 'Configure the active Patrolman / Patrolwoman (Pat) rank before hiring.' using errcode = 'P0001'; end if;
  if employee_profile.email is null then raise exception 'Applicant account profile is incomplete.' using errcode = 'P0001'; end if;
  insert into public.employees (profile_id, employee_number, first_name, middle_name, last_name, qualifier, place_of_birth, date_of_birth, gender, civil_status, religion, personal_email, phone, address, department_id, rank_id, employment_status, employment_started_on)
  values (applicant_row.profile_id, upper(btrim(target_badge_number)), applicant_row.first_name, applicant_row.middle_name, applicant_row.last_name, applicant_row.qualifier, applicant_row.place_of_birth, applicant_row.date_of_birth, applicant_row.gender, applicant_row.civil_status, applicant_row.religion, lower(btrim(employee_profile.email)), applicant_row.phone, applicant_row.address, (select opening.department_id from public.job_openings opening where opening.id = application_row.job_opening_id), patrol_rank.id, 'active', current_date)
  returning id into new_employee_id;
  update public.applications set status = 'Hired', hired_employee_id = new_employee_id, reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  insert into public.employee_activation_requests (employee_id, profile_id, application_id, requested_by_user_id) values (new_employee_id, applicant_row.profile_id, target_application_id, caller_id);
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note) values (target_application_id, caller_id, application_row.status, 'Hired', nullif(btrim(decision_note), ''));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'applications', target_application_id::text, 'hired', jsonb_build_object('employee_id', new_employee_id, 'profile_id', applicant_row.profile_id));
  return new_employee_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.reference_label(referencing_table text, referencing_column text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case referencing_table
    when 'ranks' then 'ranks'
    when 'employees' then case when referencing_column = 'profile_id' then 'linked personnel record' else 'personnel records' end
    when 'service_history' then 'service history entries'
    when 'job_openings' then 'job openings'
    when 'applications' then 'job applications'
    when 'promotion_criteria' then 'promotion criteria'
    when 'promotion_criteria_requirements' then 'promotion criteria requirements'
    when 'promotion_evaluations' then 'promotion evaluations'
    when 'promotion_evaluation_evidence' then 'promotion evaluation evidence'
    when 'employee_promotion_eligibility_summaries' then 'promotion eligibility summaries'
    when 'performance_ratings' then 'performance ratings'
    when 'leave_types' then 'leave types'
    when 'leave_requests' then 'leave requests'
    when 'leave_request_attachments' then 'leave attachments'
    when 'leave_request_history' then 'leave decisions'
    when 'deployments' then 'deployments'
    when 'deployment_history' then 'deployment history entries'
    when 'profile_change_requests' then 'profile change requests'
    when 'profile_change_request_documents' then 'profile change documents'
    when 'applicant_documents' then 'application documents'
    when 'applicant_profile_documents' then 'applicant profile documents'
    when 'application_ai_scores' then 'AI screening results'
    when 'employee_activation_requests' then 'employee activation requests'
    when 'attendance_integration_settings' then 'attendance integration settings'
    when 'attendance_identity_mappings' then 'attendance identity mappings'
    when 'attendance_imports' then 'attendance imports'
    when 'attendance_logs' then 'attendance logs'
    when 'attendance_unmatched_events' then 'unmatched attendance events'
    else replace(referencing_table, '_', ' ')
  end;
$function$
;

CREATE OR REPLACE FUNCTION private.save_job_opening(target_job_id bigint, target_department_id bigint, target_rank_id bigint, target_title text, target_description text, target_location text, target_closes_on date, target_status text, requested_criteria jsonb)
 RETURNS job_openings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  job_row public.job_openings%rowtype;
  criterion jsonb;
  criterion_kind text;
  criterion_requirement text;
  criterion_ordinal integer := 0;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'Human Resources access is required.' using errcode = '42501';
  end if;
  if target_title is null or char_length(btrim(target_title)) not between 2 and 160
    or target_description is null or char_length(btrim(target_description)) not between 20 and 10000
    or target_location is not null and char_length(btrim(target_location)) not between 2 and 160
    or target_status is null or target_status not in ('draft', 'published', 'closed') then
    raise exception 'Job opening details are invalid.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.departments where id = target_department_id and is_active)
    or not exists (select 1 from public.ranks where id = target_rank_id and is_active) then
    raise exception 'Choose an active department and an active rank.' using errcode = '22023';
  end if;
  if requested_criteria is null or jsonb_typeof(requested_criteria) <> 'array'
    or jsonb_array_length(requested_criteria) not between 1 and 30 then
    raise exception 'Provide between 1 and 30 qualification criteria.' using errcode = '22023';
  end if;
  for criterion in select value from jsonb_array_elements(requested_criteria) loop
    criterion_kind := criterion ->> 'kind';
    criterion_requirement := btrim(criterion ->> 'requirement');
    if criterion_kind not in ('education', 'eligibility', 'experience', 'skill', 'certification', 'other')
      or criterion_requirement is null or char_length(criterion_requirement) not between 2 and 1000
      or criterion ? 'isRequired' and jsonb_typeof(criterion -> 'isRequired') <> 'boolean' then
      raise exception 'Qualification criterion is invalid.' using errcode = '22023';
    end if;
  end loop;
  if target_job_id is null then
    insert into public.job_openings (department_id, rank_id, title, description, location, closes_on, status, published_at, created_by_user_id)
    values (target_department_id, target_rank_id, btrim(target_title), btrim(target_description), nullif(btrim(target_location), ''), target_closes_on, target_status, case when target_status = 'published' then clock_timestamp() else null end, caller_id)
    returning * into job_row;
  else
    select * into job_row from public.job_openings where id = target_job_id for update;
    if not found then raise exception 'Job opening was not found.' using errcode = 'P0001'; end if;
    update public.job_openings
    set department_id = target_department_id, rank_id = target_rank_id, title = btrim(target_title),
        description = btrim(target_description), location = nullif(btrim(target_location), ''), closes_on = target_closes_on,
        status = target_status, published_at = case when target_status = 'published' then coalesce(job_row.published_at, clock_timestamp()) else null end
    where id = target_job_id returning * into job_row;
    delete from public.job_qualification_criteria where job_opening_id = target_job_id;
  end if;
  for criterion in select value from jsonb_array_elements(requested_criteria) loop
    criterion_ordinal := criterion_ordinal + 1;
    insert into public.job_qualification_criteria (job_opening_id, ordinal, kind, requirement, is_required)
    values (job_row.id, criterion_ordinal, criterion ->> 'kind', btrim(criterion ->> 'requirement'), coalesce((criterion ->> 'isRequired')::boolean, true));
  end loop;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'job_openings', job_row.id::text, case when target_job_id is null then 'created' else 'updated' end, jsonb_build_object('status', target_status, 'criteria_count', criterion_ordinal));
  return job_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.update_promotion_criterion(target_criterion_id uuid, expected_updated_at timestamp with time zone, target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_is_active boolean, target_requirements jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller_id uuid := private.require_active_hr(); criterion_row public.promotion_criteria%rowtype; item jsonb; ordinal_value integer := 0; kind_value text; name_value text; label_value text; next_rank_id integer := target_rank_id;
begin
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id for update;
  if not found then raise exception 'Promotion criteria were not found.' using errcode = 'P0001'; end if;
  if expected_updated_at is null or criterion_row.updated_at <> expected_updated_at then raise exception 'Promotion criteria changed. Refresh and try again.' using errcode = 'P0001'; end if;
  if target_minimum_years not between 0 and 100 or target_minimum_rating is not null and target_minimum_rating not between 1 and 5 or jsonb_typeof(target_requirements) <> 'array' or not exists (select 1 from public.ranks where id = next_rank_id) then raise exception 'Promotion criteria are invalid.' using errcode = '22023'; end if;
  if exists (select 1 from public.promotion_evaluation_evidence evidence join public.promotion_criteria_requirements requirement on requirement.id = evidence.requirement_id where requirement.criterion_id = criterion_row.id) then raise exception 'Criteria with linked evaluation evidence cannot replace requirements.' using errcode = 'P0001'; end if;
  delete from public.promotion_criteria_requirements where criterion_id = criterion_row.id;
  for item in select value from jsonb_array_elements(target_requirements) loop
    ordinal_value := ordinal_value + 1; kind_value := item ->> 'recordKind'; name_value := btrim(item ->> 'requiredName'); label_value := btrim(item ->> 'label');
    if kind_value not in ('qualification', 'certification', 'training') or name_value is null or name_value = '' or label_value is null or label_value = '' then raise exception 'Promotion requirement is invalid.' using errcode = '22023'; end if;
    insert into public.promotion_criteria_requirements (criterion_id, ordinal, record_kind, required_name, label, is_mandatory) values (criterion_row.id, ordinal_value, kind_value, name_value, label_value, coalesce((item ->> 'isMandatory')::boolean, true));
  end loop;
  update public.promotion_criteria set target_rank_id = next_rank_id, minimum_years_of_service = target_minimum_years, minimum_performance_rating = target_minimum_rating, is_active = target_is_active, updated_by_user_id = caller_id, updated_at = greatest(clock_timestamp(), criterion_row.updated_at + interval '1 microsecond') where id = criterion_row.id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_criteria', criterion_row.id::text, 'updated', '{}'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_promotion_criterion(target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_requirements jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin return private.create_promotion_criterion(target_rank_id, target_minimum_years, target_minimum_rating, target_requirements); end; $function$
;

CREATE OR REPLACE FUNCTION public.create_promotion_evaluation(target_employee_id uuid, target_rank_id integer, target_criterion_id uuid, target_evaluated_on date, target_recommendation text, target_notes text, target_evidence jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin return private.create_promotion_evaluation(target_employee_id, target_rank_id, target_criterion_id, target_evaluated_on, target_recommendation, target_notes, target_evidence); end; $function$
;

CREATE OR REPLACE FUNCTION public.save_job_opening(target_job_id bigint, target_department_id bigint, target_rank_id bigint, target_title text, target_description text, target_location text, target_closes_on date, target_status text, requested_criteria jsonb)
 RETURNS job_openings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return private.save_job_opening(
    target_job_id,
    target_department_id,
    target_rank_id,
    target_title,
    target_description,
    target_location,
    target_closes_on,
    target_status,
    requested_criteria
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_promotion_criterion_active(target_criterion_id uuid, next_is_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := private.require_active_hr();
  criterion_row public.promotion_criteria%rowtype;
begin
  if next_is_active is null then raise exception 'Choose whether the criteria are active.' using errcode = '22023'; end if;
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id for update;
  if criterion_row.id is null then raise exception 'Promotion criteria were not found.' using errcode = 'P0001'; end if;
  if criterion_row.is_active = next_is_active then return; end if;
  update public.promotion_criteria
  set is_active = next_is_active,
      updated_by_user_id = caller_id,
      updated_at = greatest(clock_timestamp(), criterion_row.updated_at + interval '1 microsecond')
  where id = criterion_row.id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'promotion_criteria', criterion_row.id::text, case when next_is_active then 'activated' else 'deactivated' end,
    jsonb_build_object('target_rank_id', criterion_row.target_rank_id));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_promotion_criterion(target_criterion_id uuid, expected_updated_at timestamp with time zone, target_rank_id integer, target_minimum_years integer, target_minimum_rating integer, target_is_active boolean, target_requirements jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin perform private.update_promotion_criterion(target_criterion_id, expected_updated_at, target_rank_id, target_minimum_years, target_minimum_rating, target_is_active, target_requirements); end; $function$
;


revoke all on function private.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb) from public, anon, authenticated;
revoke all on function private.create_promotion_criterion(integer, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function private.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb) from public, anon;
revoke all on function public.create_promotion_criterion(integer, integer, integer, jsonb) from public, anon;
revoke all on function public.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb) from public, anon;
revoke all on function public.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb) from public, anon;
grant execute on function public.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb) to authenticated, service_role;
grant execute on function public.create_promotion_criterion(integer, integer, integer, jsonb) to authenticated, service_role;
grant execute on function public.create_promotion_evaluation(uuid, integer, uuid, date, text, text, jsonb) to authenticated, service_role;
grant execute on function public.update_promotion_criterion(uuid, timestamptz, integer, integer, integer, boolean, jsonb) to authenticated, service_role;
