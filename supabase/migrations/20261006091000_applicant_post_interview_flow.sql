-- Client consultation (2026-10-06): the whole applicant cycle stays in the system instead of
-- ending at the interview.
--
-- After the interview in San Juan the applicant is endorsed to Crame, where the BMI and the
-- neuro-psychiatric exam take place. The applicant uploads proof of passing the BMI, and HR records
-- progress (for neuro exam, for training) with remarks the applicant can see.
--
--   Interview → Endorsed to Crame → Neuro Exam → For Training → Hired
--
-- * Moving to Neuro Exam requires the applicant's BMI proof on file.
-- * Hiring now happens only from For Training, at the end of the cycle.
-- * HR can add a remark at any stage without changing the status. A remark is a status-history
--   row whose previous and next status are the same, so it shows in the existing timeline.

alter table public.applications
  drop constraint applications_status_check,
  add constraint applications_status_check
    check (status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Needs Revision', 'Endorsed to Crame', 'Neuro Exam', 'For Training', 'Hired', 'Not Selected'));

alter table public.application_status_history
  drop constraint application_status_history_previous_status_check,
  add constraint application_status_history_previous_status_check
    check (previous_status is null or previous_status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Needs Revision', 'Endorsed to Crame', 'Neuro Exam', 'For Training', 'Hired', 'Not Selected')),
  drop constraint application_status_history_next_status_check,
  add constraint application_status_history_next_status_check
    check (next_status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Needs Revision', 'Endorsed to Crame', 'Neuro Exam', 'For Training', 'Hired', 'Not Selected'));

alter table public.applicant_documents
  drop constraint applicant_documents_kind_check,
  add constraint applicant_documents_kind_check check (kind in ('cv', 'credential', 'bmi_proof'));

create or replace function private.application_status_message(target_status text)
returns text language sql immutable set search_path = '' as $$
  select case target_status
    when 'Under Review' then 'HR is reviewing your application.'
    when 'Shortlisted' then 'You have been shortlisted.'
    when 'Interview' then 'Your requirements are complete. You are now for interview.'
    when 'Endorsed to Crame' then 'You passed the interview and are endorsed to Camp Crame for the BMI and neuro-psychiatric exam. Upload your proof of passing the BMI on your application page.'
    when 'Neuro Exam' then 'Your BMI proof was accepted. You are now for the neuro-psychiatric exam.'
    when 'For Training' then 'You are endorsed for training.'
    when 'Needs Revision' then 'HR asked you to revise your documents.'
    when 'Not Selected' then 'You were not selected for this opening.'
    else 'Your application status is now ' || target_status || '.'
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
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  select applicant.profile_id into recipient_profile_id
  from public.applicants applicant
  where applicant.id = application_row.applicant_id;
  if not (
    (application_row.status = 'Submitted' and target_next_status = 'Under Review')
    or (application_row.status = 'Under Review' and target_next_status in ('Shortlisted', 'Interview', 'Needs Revision', 'Not Selected'))
    or (application_row.status = 'Shortlisted' and target_next_status in ('Interview', 'Needs Revision', 'Not Selected'))
    or (application_row.status = 'Interview' and target_next_status in ('Shortlisted', 'Endorsed to Crame', 'Needs Revision', 'Not Selected'))
    or (application_row.status = 'Endorsed to Crame' and target_next_status in ('Neuro Exam', 'Not Selected'))
    or (application_row.status = 'Neuro Exam' and target_next_status in ('For Training', 'Not Selected'))
    or (application_row.status = 'For Training' and target_next_status = 'Not Selected')
  ) then raise exception 'Invalid application status transition.' using errcode = '22023'; end if;
  if target_next_status = 'Neuro Exam' and not exists (
    select 1 from public.applicant_documents document where document.application_id = target_application_id and document.kind = 'bmi_proof'
  ) then
    raise exception 'The applicant has not uploaded proof of passing the BMI yet.' using errcode = '22023';
  end if;
  update public.applications set status = target_next_status, reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, application_row.status, target_next_status, clean_note);
  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    recipient_profile_id,
    'application_status_updated',
    'Application updated',
    private.application_status_message(target_next_status) || coalesce(' Note: ' || clean_note, ''),
    '/applicant/applications/' || target_application_id::text
  );
end;
$$;

create or replace function private.add_application_remark(target_application_id uuid, remark text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  recipient_profile_id uuid;
  clean_remark text := nullif(btrim(remark), '');
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'HR access is required.' using errcode = '42501';
  end if;
  if clean_remark is null or char_length(clean_remark) > 2000 then
    raise exception 'Enter a remark of up to 2000 characters.' using errcode = '22023';
  end if;
  select application.* into application_row from public.applications application where application.id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  select applicant.profile_id into recipient_profile_id from public.applicants applicant where applicant.id = application_row.applicant_id;
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, application_row.status, application_row.status, clean_remark);
  update public.applications set updated_at = now() where id = target_application_id;
  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (recipient_profile_id, 'application_remark_added', 'New remark on your application', clean_remark, '/applicant/applications/' || target_application_id::text);
end;
$$;

-- The applicant uploads proof of passing the BMI while endorsed to Crame. A new upload replaces the old one.
create or replace function private.submit_bmi_proof(target_application_id uuid, submitted_document jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  expected_prefix text;
begin
  if caller_id is null then raise exception 'Authenticated applicant access is required.' using errcode = '42501'; end if;
  select application.* into application_row
  from public.applications application join public.applicants applicant on applicant.id = application.applicant_id
  where application.id = target_application_id and applicant.profile_id = caller_id for update of application;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status <> 'Endorsed to Crame' then raise exception 'Upload the BMI proof once you are endorsed to Crame.' using errcode = '22023'; end if;
  expected_prefix := 'applicants/' || caller_id::text || '/' || target_application_id::text || '/';
  if jsonb_typeof(submitted_document) <> 'object'
    or submitted_document ->> 'objectPath' !~ ('^' || expected_prefix || '[0-9a-f-]{36}\.(pdf|png|jpe?g)$')
    or submitted_document ->> 'mimeType' not in ('application/pdf', 'image/png', 'image/jpeg')
    or coalesce((submitted_document ->> 'sizeBytes')::integer, 0) not between 1 and 10485760
    or nullif(btrim(submitted_document ->> 'fileName'), '') is null
    or char_length(btrim(submitted_document ->> 'fileName')) > 255 then
    raise exception 'Upload the BMI proof as a PDF, PNG or JPEG file up to 10 MB.' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects object where object.bucket_id = 'applicant-documents' and object.name = submitted_document ->> 'objectPath' and object.owner_id = caller_id::text) then
    raise exception 'The BMI proof was not uploaded by the applicant.' using errcode = '42501';
  end if;
  delete from public.applicant_documents where application_id = target_application_id and kind = 'bmi_proof';
  insert into public.applicant_documents (application_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
  values (target_application_id, 'bmi_proof', submitted_document ->> 'objectPath', btrim(submitted_document ->> 'fileName'), submitted_document ->> 'mimeType', (submitted_document ->> 'sizeBytes')::integer, caller_id);
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, application_row.status, application_row.status, 'Proof of passing the BMI uploaded by the applicant.');
  update public.applications set updated_at = now() where id = target_application_id;
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
  patrol_rank public.ranks%rowtype;
  new_employee_id uuid;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then raise exception 'HR access is required.' using errcode = '42501'; end if;
  if target_badge_number is null or char_length(btrim(target_badge_number)) not between 3 and 32 then raise exception 'Enter a valid Badge Number.' using errcode = '22023'; end if;
  select * into application_row from public.applications where id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status <> 'For Training' then raise exception 'Only applicants endorsed for training can be hired.' using errcode = '22023'; end if;
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
  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (applicant_row.profile_id, 'application_status_updated', 'Application updated', 'Congratulations! You have been hired.' || coalesce(' Note: ' || nullif(btrim(decision_note), ''), ''), '/applicant/applications/' || target_application_id::text);
  return new_employee_id;
end;
$$;

create or replace function public.add_application_remark(target_application_id uuid, remark text)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.add_application_remark(target_application_id, remark); end;
$$;

create or replace function public.submit_bmi_proof(target_application_id uuid, submitted_document jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.submit_bmi_proof(target_application_id, submitted_document); end;
$$;

revoke all on function private.application_status_message(text), private.transition_application_status(uuid, text, text), private.add_application_remark(uuid, text), private.submit_bmi_proof(uuid, jsonb), private.hire_application(uuid, text, text) from public, anon, authenticated;
revoke all on function public.add_application_remark(uuid, text), public.submit_bmi_proof(uuid, jsonb) from public, anon;
grant execute on function public.add_application_remark(uuid, text), public.submit_bmi_proof(uuid, jsonb) to authenticated;
