-- Applicant recruitment workflow approved from the 2026-10-08 PDF feedback.
-- Legacy statuses are mapped without deleting applications, history, or documents.

alter table public.applications drop constraint applications_status_check;
alter table public.application_status_history
  drop constraint application_status_history_previous_status_check,
  drop constraint application_status_history_next_status_check;

update public.applications
set status = case status
  when 'Submitted' then 'Application Submission'
  when 'Under Review' then 'Application Submission'
  when 'Needs Revision' then 'Application Submission'
  when 'Interview' then 'Panel Interview'
  when 'Endorsed to Crame' then 'Physical & Medical Examination'
  when 'Neuro Exam' then 'Neuro-Psychiatric Examination'
  when 'For Training' then 'Shortlisted'
  else status
end;

update public.application_status_history
set previous_status = case previous_status
  when 'Submitted' then 'Application Submission'
  when 'Under Review' then 'Application Submission'
  when 'Needs Revision' then 'Application Submission'
  when 'Interview' then 'Panel Interview'
  when 'Endorsed to Crame' then 'Physical & Medical Examination'
  when 'Neuro Exam' then 'Neuro-Psychiatric Examination'
  when 'For Training' then 'Shortlisted'
  else previous_status
end,
next_status = case next_status
  when 'Submitted' then 'Application Submission'
  when 'Under Review' then 'Application Submission'
  when 'Needs Revision' then 'Application Submission'
  when 'Interview' then 'Panel Interview'
  when 'Endorsed to Crame' then 'Physical & Medical Examination'
  when 'Neuro Exam' then 'Neuro-Psychiatric Examination'
  when 'For Training' then 'Shortlisted'
  else next_status
end;

alter table public.applications
  alter column status set default 'Application Submission',
  add constraint applications_status_check check (status in (
    'Application Submission', 'Physical Agility Test', 'Physical & Medical Examination',
    'Neuro-Psychiatric Examination', 'Drug Test', 'Character & Background Investigation',
    'Panel Interview', 'Final Evaluation', 'Shortlisted', 'Not Selected', 'Hired'
  ));

alter table public.application_status_history
  add constraint application_status_history_previous_status_check check (previous_status is null or previous_status in (
    'Application Submission', 'Physical Agility Test', 'Physical & Medical Examination',
    'Neuro-Psychiatric Examination', 'Drug Test', 'Character & Background Investigation',
    'Panel Interview', 'Final Evaluation', 'Shortlisted', 'Not Selected', 'Hired'
  )),
  add constraint application_status_history_next_status_check check (next_status in (
    'Application Submission', 'Physical Agility Test', 'Physical & Medical Examination',
    'Neuro-Psychiatric Examination', 'Drug Test', 'Character & Background Investigation',
    'Panel Interview', 'Final Evaluation', 'Shortlisted', 'Not Selected', 'Hired'
  ));

create or replace function private.application_status_message(target_status text)
returns text language sql immutable set search_path = '' as $$
  select case target_status
    when 'Application Submission' then 'Your application is now under review.'
    when 'Physical Agility Test' then 'You are scheduled for the Physical Agility Test.'
    when 'Physical & Medical Examination' then 'You are proceeding to the Physical & Medical Examination.'
    when 'Neuro-Psychiatric Examination' then 'You are proceeding to the Neuro-Psychiatric Examination.'
    when 'Drug Test' then 'You are proceeding to the Drug Test.'
    when 'Character & Background Investigation' then 'Your character and background investigation is in progress.'
    when 'Panel Interview' then 'You are proceeding to the Panel Interview.'
    when 'Final Evaluation' then 'Your application is in Final Evaluation.'
    when 'Shortlisted' then 'You have been shortlisted.'
    when 'Not Selected' then 'You were not selected for this opening.'
    else 'Your application status is now ' || target_status || '.'
  end;
$$;

create or replace function private.transition_application_status(
  target_application_id uuid,
  target_next_status text,
  transition_note text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  recipient_profile_id uuid;
  clean_note text := nullif(btrim(transition_note), '');
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'HR access is required.' using errcode = '42501';
  end if;
  select application.* into application_row from public.applications application where application.id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  select applicant.profile_id into recipient_profile_id from public.applicants applicant where applicant.id = application_row.applicant_id;
  if not (
    (application_row.status = 'Application Submission' and target_next_status = 'Physical Agility Test')
    or (application_row.status = 'Physical Agility Test' and target_next_status = 'Physical & Medical Examination')
    or (application_row.status = 'Physical & Medical Examination' and target_next_status = 'Neuro-Psychiatric Examination')
    or (application_row.status = 'Neuro-Psychiatric Examination' and target_next_status = 'Drug Test')
    or (application_row.status = 'Drug Test' and target_next_status = 'Character & Background Investigation')
    or (application_row.status = 'Character & Background Investigation' and target_next_status = 'Panel Interview')
    or (application_row.status = 'Panel Interview' and target_next_status = 'Final Evaluation')
    or (application_row.status = 'Final Evaluation' and target_next_status in ('Shortlisted', 'Not Selected'))
  ) then raise exception 'Invalid application status transition.' using errcode = '22023'; end if;
  update public.applications set status = target_next_status, reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, application_row.status, target_next_status, clean_note);
  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (recipient_profile_id, 'application_status_updated', 'Application updated', private.application_status_message(target_next_status) || coalesce(' Note: ' || clean_note, ''), '/applicant/applications/' || target_application_id::text);
end;
$$;

create or replace function private.hire_application(target_application_id uuid, target_badge_number text, decision_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
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
  if application_row.status <> 'Shortlisted' then raise exception 'Only shortlisted applicants can be hired.' using errcode = '22023'; end if;
  select * into applicant_row from public.applicants where id = application_row.applicant_id;
  select * into employee_profile from public.profiles where id = applicant_row.profile_id;
  select * into patrol_rank from public.ranks where upper(code) = 'PAT' and is_active;
  if patrol_rank.id is null then raise exception 'Configure the active Patrolman / Patrolwoman (PAT) rank before hiring.' using errcode = 'P0001'; end if;
  if employee_profile.email is null then raise exception 'Applicant account profile is incomplete.' using errcode = 'P0001'; end if;
  insert into public.employees (profile_id, employee_number, first_name, middle_name, last_name, qualifier, place_of_birth, date_of_birth, gender, civil_status, religion, personal_email, phone, address, department_id, rank_id, employment_status, employment_started_on)
  values (applicant_row.profile_id, upper(btrim(target_badge_number)), applicant_row.first_name, applicant_row.middle_name, applicant_row.last_name, applicant_row.qualifier, applicant_row.place_of_birth, applicant_row.date_of_birth, applicant_row.gender, applicant_row.civil_status, applicant_row.religion, lower(btrim(employee_profile.email)), applicant_row.phone, applicant_row.address, (select opening.department_id from public.job_openings opening where opening.id = application_row.job_opening_id), patrol_rank.id, 'active', current_date)
  returning id into new_employee_id;
  update public.applications set status = 'Hired', hired_employee_id = new_employee_id, reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  insert into public.employee_activation_requests (employee_id, profile_id, application_id, requested_by_user_id) values (new_employee_id, applicant_row.profile_id, target_application_id, caller_id);
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note) values (target_application_id, caller_id, application_row.status, 'Hired', nullif(btrim(decision_note), ''));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'applications', target_application_id::text, 'hired', jsonb_build_object('employee_id', new_employee_id, 'profile_id', applicant_row.profile_id));
  insert into public.notifications (recipient_user_id, type, title, body, link) values (applicant_row.profile_id, 'application_status_updated', 'Application updated', 'Congratulations! You have been hired.' || coalesce(' Note: ' || nullif(btrim(decision_note), ''), ''), '/applicant/applications/' || target_application_id::text);
  return new_employee_id;
end;
$$;

create or replace function private.submit_application(target_application_id uuid, target_job_opening_id bigint, submitted_cover_note text, submitted_documents jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  target_applicant_id uuid;
  document jsonb;
  expected_prefix text;
  has_cv boolean := false;
begin
  if caller_id is null then raise exception 'Authenticated applicant access is required.' using errcode = '42501'; end if;
  select applicant.id into target_applicant_id from public.applicants applicant where applicant.profile_id = caller_id;
  if target_applicant_id is null then raise exception 'Complete an applicant profile before applying.' using errcode = '42501'; end if;
  if (select count(distinct profile_document.kind) from public.applicant_profile_documents profile_document where profile_document.applicant_id = target_applicant_id and profile_document.kind in ('eligibility', 'diploma', 'resume', 'psa', 'photo')) <> 5 then raise exception 'Upload your eligibility, diploma, CV / resume, PSA birth certificate, and 2x2 picture before applying.' using errcode = '42501'; end if;
  if not exists (select 1 from public.job_openings opening where opening.id = target_job_opening_id and opening.status = 'published' and (opening.closes_on is null or opening.closes_on >= current_date)) then raise exception 'The selected job opening is not accepting applications.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.applications application where application.applicant_id = target_applicant_id and application.job_opening_id = target_job_opening_id) then raise exception 'You have already applied for this opening.' using errcode = '23505'; end if;
  if jsonb_typeof(submitted_documents) <> 'array' or jsonb_array_length(submitted_documents) < 1 or jsonb_array_length(submitted_documents) > 10 then raise exception 'Provide between one and ten application documents.' using errcode = '22023'; end if;
  expected_prefix := 'applicants/' || caller_id::text || '/' || target_application_id::text || '/';
  for document in select value from jsonb_array_elements(submitted_documents) loop
    if document ->> 'kind' not in ('cv', 'credential') or document ->> 'objectPath' !~ ('^' || expected_prefix || '[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g)$') or document ->> 'mimeType' not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg') or coalesce((document ->> 'sizeBytes')::integer, 0) not between 1 and 10485760 or nullif(btrim(document ->> 'fileName'), '') is null then raise exception 'Invalid application document.' using errcode = '22023'; end if;
    if document ->> 'kind' = 'cv' then has_cv := true; end if;
    if not exists (select 1 from storage.objects object where object.bucket_id = 'applicant-documents' and object.name = document ->> 'objectPath' and object.owner_id = caller_id::text) then raise exception 'Application document was not uploaded by the applicant.' using errcode = '42501'; end if;
  end loop;
  if not has_cv then raise exception 'Attach a CV before submitting.' using errcode = '22023'; end if;
  insert into public.applications (id, applicant_id, job_opening_id, cover_note) values (target_application_id, target_applicant_id, target_job_opening_id, nullif(btrim(submitted_cover_note), ''));
  for document in select value from jsonb_array_elements(submitted_documents) loop
    insert into public.applicant_documents (application_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id) values (target_application_id, document ->> 'kind', document ->> 'objectPath', btrim(document ->> 'fileName'), document ->> 'mimeType', (document ->> 'sizeBytes')::integer, caller_id);
  end loop;
  insert into public.application_status_history (application_id, actor_user_id, next_status, note) values (target_application_id, caller_id, 'Application Submission', null);
  insert into public.notifications (recipient_user_id, type, title, body, link) values (caller_id, 'application_status_updated', 'Application updated', private.application_status_message('Application Submission'), '/applicant/applications/' || target_application_id::text);
  return target_application_id;
end;
$$;

drop function if exists public.resubmit_application(uuid, jsonb);
drop function if exists private.submit_bmi_proof(uuid, jsonb);
drop function if exists public.submit_bmi_proof(uuid, jsonb);

revoke all on function private.application_status_message(text), private.transition_application_status(uuid, text, text), private.hire_application(uuid, text, text) from public, anon, authenticated;
revoke all on function public.transition_application_status(uuid, text, text), public.hire_application(uuid, text, text) from public, anon;
grant execute on function public.transition_application_status(uuid, text, text), public.hire_application(uuid, text, text) to authenticated;
