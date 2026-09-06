alter table public.applications
  drop constraint applications_status_check,
  add constraint applications_status_check
    check (status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Needs Revision', 'Hired', 'Not Selected'));

alter table public.application_status_history
  drop constraint application_status_history_previous_status_check,
  add constraint application_status_history_previous_status_check
    check (previous_status is null or previous_status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Needs Revision', 'Hired', 'Not Selected')),
  drop constraint application_status_history_next_status_check,
  add constraint application_status_history_next_status_check
    check (next_status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Needs Revision', 'Hired', 'Not Selected'));

alter table public.job_qualification_criteria
  drop constraint job_qualification_criteria_kind_check,
  add constraint job_qualification_criteria_kind_check
    check (kind in ('education', 'eligibility', 'experience', 'skill', 'certification', 'other'));

create or replace function private.save_job_opening(
  target_job_id bigint,
  target_department_id bigint,
  target_position_id bigint,
  target_title text,
  target_description text,
  target_location text,
  target_closes_on date,
  target_status text,
  requested_criteria jsonb
)
returns public.job_openings
language plpgsql
security definer
set search_path = ''
as $$
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
  if not exists (
    select 1 from public.departments department
    join public.positions position on position.department_id = department.id
    where department.id = target_department_id and position.id = target_position_id
      and department.is_active and position.is_active
  ) then
    raise exception 'Choose an active position in the selected department.' using errcode = '22023';
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
    insert into public.job_openings (department_id, position_id, title, description, location, closes_on, status, published_at, created_by_user_id)
    values (target_department_id, target_position_id, btrim(target_title), btrim(target_description), nullif(btrim(target_location), ''), target_closes_on, target_status, case when target_status = 'published' then clock_timestamp() else null end, caller_id)
    returning * into job_row;
  else
    select * into job_row from public.job_openings where id = target_job_id for update;
    if not found then raise exception 'Job opening was not found.' using errcode = 'P0001'; end if;
    update public.job_openings
    set department_id = target_department_id, position_id = target_position_id, title = btrim(target_title),
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
$$;

create or replace function private.transition_application_status(
  target_application_id uuid,
  target_next_status text,
  transition_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  recipient_profile_id uuid;
  clean_note text := nullif(btrim(transition_note), '');
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'HR access is required.' using errcode = '42501';
  end if;
  select application.* into application_row
  from public.applications application
  where application.id = target_application_id
  for update;
  select applicant.profile_id into recipient_profile_id
  from public.applicants applicant
  where applicant.id = application_row.applicant_id;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if not (
    (application_row.status = 'Submitted' and target_next_status = 'Under Review')
    or (application_row.status = 'Under Review' and target_next_status in ('Shortlisted', 'Interview', 'Needs Revision', 'Not Selected'))
    or (application_row.status = 'Shortlisted' and target_next_status in ('Interview', 'Needs Revision', 'Not Selected'))
    or (application_row.status = 'Interview' and target_next_status in ('Shortlisted', 'Needs Revision', 'Not Selected'))
  ) then raise exception 'Invalid application status transition.' using errcode = '22023'; end if;
  update public.applications set status = target_next_status, reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, application_row.status, target_next_status, clean_note);
  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    recipient_profile_id,
    'application_status_updated',
    'Application updated',
    'Your application status is now ' || target_next_status || coalesce('. Note: ' || clean_note, '.'),
    '/applicant/applications/' || target_application_id::text
  );
end;
$$;

create or replace function public.transition_application_status(target_application_id uuid, target_next_status text, transition_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.transition_application_status(target_application_id, target_next_status, transition_note); end;
$$;

create or replace function public.resubmit_application(target_application_id uuid, submitted_documents jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  document jsonb;
  expected_prefix text;
  has_cv boolean := false;
begin
  if caller_id is null then raise exception 'Authenticated applicant access is required.' using errcode = '42501'; end if;
  select application.* into application_row
  from public.applications application join public.applicants applicant on applicant.id = application.applicant_id
  where application.id = target_application_id and applicant.profile_id = caller_id for update of application;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status <> 'Needs Revision' then raise exception 'Only applications marked Needs Revision can be resubmitted.' using errcode = '22023'; end if;
  if jsonb_typeof(submitted_documents) <> 'array' or jsonb_array_length(submitted_documents) not between 1 and 10 then
    raise exception 'Provide between one and ten application documents.' using errcode = '22023';
  end if;
  expected_prefix := 'applicants/' || caller_id::text || '/' || target_application_id::text || '/';
  for document in select value from jsonb_array_elements(submitted_documents) loop
    if document ->> 'kind' not in ('cv', 'credential')
      or document ->> 'objectPath' !~ ('^' || expected_prefix || '[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g)$')
      or document ->> 'mimeType' not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg')
      or coalesce((document ->> 'sizeBytes')::integer, 0) not between 1 and 10485760
      or nullif(btrim(document ->> 'fileName'), '') is null then raise exception 'Invalid application document.' using errcode = '22023'; end if;
    if document ->> 'kind' = 'cv' then has_cv := true; end if;
    if not exists (select 1 from storage.objects object where object.bucket_id = 'applicant-documents' and object.name = document ->> 'objectPath' and object.owner_id = caller_id::text) then
      raise exception 'Application document was not uploaded by the applicant.' using errcode = '42501';
    end if;
  end loop;
  if not has_cv then raise exception 'Attach a CV before resubmitting.' using errcode = '22023'; end if;
  for document in select value from jsonb_array_elements(submitted_documents) loop
    insert into public.applicant_documents (application_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (target_application_id, document ->> 'kind', document ->> 'objectPath', btrim(document ->> 'fileName'), document ->> 'mimeType', (document ->> 'sizeBytes')::integer, caller_id);
  end loop;
  update public.applications set status = 'Under Review', reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, 'Needs Revision', 'Under Review', 'Resubmitted by applicant.');
end;
$$;

create or replace function public.delete_draft_job_opening(target_job_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := (select auth.uid()); begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then raise exception 'HR access is required.' using errcode = '42501'; end if;
  if not exists (select 1 from public.job_openings opening where opening.id = target_job_id and opening.status = 'draft') then raise exception 'Only draft openings can be deleted.' using errcode = '22023'; end if;
  if exists (select 1 from public.applications application where application.job_opening_id = target_job_id) then raise exception 'Openings with applications cannot be deleted.' using errcode = '22023'; end if;
  delete from public.job_openings where id = target_job_id;
end;
$$;

create or replace function public.withdraw_job_opening(target_job_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := (select auth.uid()); begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then raise exception 'HR access is required.' using errcode = '42501'; end if;
  update public.job_openings set status = 'closed', published_at = null where id = target_job_id and status <> 'closed';
  if not found then raise exception 'An open job opening was not found.' using errcode = 'P0001'; end if;
end;
$$;

create or replace function private.hire_application(target_application_id uuid, target_badge_number text, decision_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  applicant_row public.applicants%rowtype;
  employee_profile public.profiles%rowtype;
  patrol_position public.positions%rowtype;
  new_employee_id uuid;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then raise exception 'HR access is required.' using errcode = '42501'; end if;
  if target_badge_number is null or char_length(btrim(target_badge_number)) not between 3 and 32 then raise exception 'Enter a valid Badge Number.' using errcode = '22023'; end if;
  select * into application_row from public.applications where id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status not in ('Shortlisted', 'Interview') then raise exception 'Only shortlisted or interviewed applications can be hired.' using errcode = '22023'; end if;
  select * into applicant_row from public.applicants where id = application_row.applicant_id;
  select * into employee_profile from public.profiles where id = applicant_row.profile_id;
  select * into patrol_position from public.positions position
  where position.is_active and lower(position.title) in ('patrolman', 'patrolwoman', 'patrolman / patrolwoman', 'patrolman / patrolwoman (pat)')
  order by position.id limit 1;
  if patrol_position.id is null then raise exception 'Configure an active Patrolman or Patrolwoman position before hiring.' using errcode = 'P0001'; end if;
  if employee_profile.email is null then raise exception 'Applicant account profile is incomplete.' using errcode = 'P0001'; end if;
  insert into public.employees (profile_id, employee_number, first_name, middle_name, last_name, qualifier, place_of_birth, date_of_birth, sex, civil_status, religion, personal_email, phone, address, department_id, position_id, employment_status, employment_started_on)
  values (applicant_row.profile_id, upper(btrim(target_badge_number)), applicant_row.first_name, applicant_row.middle_name, applicant_row.last_name, applicant_row.qualifier, applicant_row.place_of_birth, applicant_row.date_of_birth, applicant_row.sex, applicant_row.civil_status, applicant_row.religion, lower(btrim(employee_profile.email)), applicant_row.phone, applicant_row.address, patrol_position.department_id, patrol_position.id, 'active', current_date)
  returning id into new_employee_id;
  update public.applications set status = 'Hired', hired_employee_id = new_employee_id, reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  insert into public.employee_activation_requests (employee_id, profile_id, application_id, requested_by_user_id) values (new_employee_id, applicant_row.profile_id, target_application_id, caller_id);
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note) values (target_application_id, caller_id, application_row.status, 'Hired', nullif(btrim(decision_note), ''));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'applications', target_application_id::text, 'hired', jsonb_build_object('employee_id', new_employee_id, 'profile_id', applicant_row.profile_id));
  return new_employee_id;
end;
$$;

create or replace function public.hire_application(target_application_id uuid, target_badge_number text, decision_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin return private.hire_application(target_application_id, target_badge_number, decision_note); end;
$$;

revoke all on function private.transition_application_status(uuid, text, text), private.hire_application(uuid, text, text) from public, anon, authenticated;
revoke all on function public.transition_application_status(uuid, text, text), public.resubmit_application(uuid, jsonb), public.delete_draft_job_opening(bigint), public.withdraw_job_opening(bigint), public.hire_application(uuid, text, text) from public, anon;
grant execute on function public.transition_application_status(uuid, text, text), public.resubmit_application(uuid, jsonb), public.delete_draft_job_opening(bigint), public.withdraw_job_opening(bigint), public.hire_application(uuid, text, text) to authenticated;

drop function public.hire_application(uuid, text, bigint, bigint, date, text);
drop function private.hire_application(uuid, text, bigint, bigint, date, text);
