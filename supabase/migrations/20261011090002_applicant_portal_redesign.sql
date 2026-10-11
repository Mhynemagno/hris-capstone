-- Capstone UI applicant redesign (Final Changes PDF pp. 4-14):
--   * The posting chosen on the landing page is remembered through registration; the applicant applies by
--     saving all required documents on the Documents page (no in-account "Apply now").
--   * HR can attach a date/time and venue when marking a stage Scheduled.
--   * Applicants can delete notifications from the notification panel.

alter table public.applicants
  add column preferred_job_opening_id bigint references public.job_openings (id) on delete set null;

create index applicants_preferred_job_opening_idx on public.applicants (preferred_job_opening_id)
  where preferred_job_opening_id is not null;

-- Same body as 20260927150000_applicant_registration_details.sql, plus the remembered posting
-- (only a published one; anything else is ignored so sign-up never fails).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  middle_name_value text := nullif(btrim(metadata ->> 'middle_name'), '');
  qualifier_value text := nullif(btrim(metadata ->> 'qualifier'), '');
  phone_value text := nullif(btrim(metadata ->> 'phone'), '');
  birthdate_value date := private.applicant_metadata_birthdate(nullif(btrim(metadata ->> 'date_of_birth'), ''));
  preferred_value bigint := case when metadata ->> 'preferred_job_opening_id' ~ '^[0-9]{1,18}$' then (metadata ->> 'preferred_job_opening_id')::bigint end;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(metadata ->> 'full_name', metadata ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'applicant'::public.app_role)
  on conflict (user_id) do nothing;

  if nullif(btrim(metadata ->> 'first_name'), '') is not null
     and nullif(btrim(metadata ->> 'last_name'), '') is not null then
    insert into public.applicants (profile_id, first_name, last_name, middle_name, qualifier, phone, date_of_birth, preferred_job_opening_id)
    values (
      new.id,
      btrim(metadata ->> 'first_name'),
      btrim(metadata ->> 'last_name'),
      case when char_length(middle_name_value) <= 80 then middle_name_value end,
      case when qualifier_value in ('Jr.', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX') then qualifier_value end,
      case when phone_value ~ '^\+639[0-9]{9}$' then phone_value end,
      case when birthdate_value < current_date then birthdate_value end,
      (select opening.id from public.job_openings opening where opening.id = preferred_value and opening.status = 'published')
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

create function private.posting_is_open(target_job_opening_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.job_openings opening
    where opening.id = target_job_opening_id and opening.status = 'published'
      and (opening.closes_on is null or opening.closes_on >= current_date)
  )
$$;
revoke all on function private.posting_is_open(bigint) from public, anon, authenticated;

create function public.set_my_preferred_job_opening(target_job_opening_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then raise exception 'Authenticated applicant access is required.' using errcode = '42501'; end if;
  if not private.posting_is_open(target_job_opening_id) then
    raise exception 'The selected job opening is not accepting applications.' using errcode = 'P0001';
  end if;
  update public.applicants set preferred_job_opening_id = target_job_opening_id, updated_at = now() where profile_id = caller_id;
  if not found then raise exception 'Complete an applicant profile before applying.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.set_my_preferred_job_opening(bigint) from public, anon;
grant execute on function public.set_my_preferred_job_opening(bigint) to authenticated;

-- The posting a Documents-page Save submits to: the remembered one while it is open, otherwise the newest
-- open posting. Postings the applicant already applied to are skipped. Null when nothing is open.
create function public.my_application_target_job()
returns bigint language sql stable security definer set search_path = '' as $$
  with me as (
    select applicant.id, applicant.preferred_job_opening_id
    from public.applicants applicant
    where applicant.profile_id = (select auth.uid())
  ),
  candidates as (
    select opening.id, opening.published_at, (opening.id is not distinct from (select preferred_job_opening_id from me)) as preferred
    from public.job_openings opening
    where private.posting_is_open(opening.id)
      and not exists (
        select 1 from public.applications application
        where application.applicant_id = (select id from me) and application.job_opening_id = opening.id
      )
  )
  select id from candidates order by preferred desc, published_at desc nulls last, id desc limit 1
$$;
revoke all on function public.my_application_target_job() from public, anon;
grant execute on function public.my_application_target_job() to authenticated;

alter table public.applications
  add column stage_scheduled_at timestamptz,
  add column stage_venue text check (stage_venue is null or (stage_venue = btrim(stage_venue) and char_length(stage_venue) between 1 and 200));

-- record_stage_result gains an optional schedule. Same body as 20261010100002_recruitment_stage_results.sql except:
-- the schedule is stored with Scheduled and cleared on any other result, the scheduled message names the date
-- and venue, and the notification links to the applicant's single status page.
drop function public.record_stage_result(uuid, text, text, jsonb);
drop function private.record_stage_result(uuid, text, text, jsonb);

create function private.record_stage_result(
  target_application_id uuid,
  target_result text,
  target_note text,
  target_document jsonb,
  target_scheduled_at timestamptz default null,
  target_venue text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  application_row public.applications%rowtype;
  recipient_profile_id uuid;
  clean_note text := nullif(btrim(target_note), '');
  clean_venue text := nullif(btrim(target_venue), '');
  next_status text;
  document_path text;
  needs_document boolean;
  message text;
begin
  if target_result is null or target_result not in ('verified', 'scheduled', 'passed', 'failed') then raise exception 'Choose a valid result.' using errcode = '22023'; end if;
  select * into application_row from public.applications where id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status not in (
    'Application Submission', 'Physical Agility Test', 'Physical & Medical Examination', 'Neuro-Psychiatric Examination',
    'Drug Test', 'Character & Background Investigation', 'Panel Interview', 'Final Evaluation'
  ) then raise exception 'This application is no longer in the recruitment process.' using errcode = '22023'; end if;
  if target_result = 'verified' and application_row.status <> 'Application Submission' then raise exception 'Verified applies only to Application Submission.' using errcode = '22023'; end if;
  if target_result = 'scheduled' and application_row.status = 'Application Submission' then raise exception 'Application Submission is verified, not scheduled.' using errcode = '22023'; end if;
  if clean_note is not null and char_length(clean_note) > 2000 then raise exception 'Notes must be at most 2000 characters.' using errcode = '22023'; end if;
  if clean_venue is not null and char_length(clean_venue) > 200 then raise exception 'Venue must be at most 200 characters.' using errcode = '22023'; end if;
  select applicant.profile_id into recipient_profile_id from public.applicants applicant where applicant.id = application_row.applicant_id;

  needs_document := target_result in ('passed', 'failed') and application_row.status <> 'Application Submission';
  if target_document is not null and jsonb_typeof(target_document) = 'object' then
    document_path := target_document ->> 'objectPath';
    if document_path is null
      or document_path !~ ('^applications/' || target_application_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$')
      or not exists (select 1 from storage.objects where bucket_id = 'recruitment-stage-documents' and name = document_path)
    then raise exception 'The supporting document was not uploaded.' using errcode = '22023'; end if;
  elsif needs_document then
    raise exception 'Upload a supporting document for this result.' using errcode = '22023';
  end if;

  if target_result in ('verified', 'scheduled') then
    update public.applications set
      stage_result = target_result,
      stage_scheduled_at = case when target_result = 'scheduled' then target_scheduled_at end,
      stage_venue = case when target_result = 'scheduled' then clean_venue end,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
    where id = target_application_id;
    insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note, result)
    values (target_application_id, caller_id, application_row.status, application_row.status, clean_note, target_result);
    message := case when target_result = 'verified' then 'Your submitted documents have been verified.'
      else 'You are scheduled for the ' || application_row.status
        || coalesce(' on ' || to_char(target_scheduled_at at time zone 'Asia/Manila', 'FMMonth FMDD, YYYY, FMHH12:MI AM'), '')
        || coalesce(' at ' || clean_venue, '') || '.' end;
  else
    next_status := case
      when target_result = 'failed' then 'Not Selected'
      when application_row.status = 'Application Submission' then 'Physical Agility Test'
      when application_row.status = 'Physical Agility Test' then 'Physical & Medical Examination'
      when application_row.status = 'Physical & Medical Examination' then 'Neuro-Psychiatric Examination'
      when application_row.status = 'Neuro-Psychiatric Examination' then 'Drug Test'
      when application_row.status = 'Drug Test' then 'Character & Background Investigation'
      when application_row.status = 'Character & Background Investigation' then 'Panel Interview'
      when application_row.status = 'Panel Interview' then 'Final Evaluation'
      else 'Shortlisted'
    end;
    update public.applications set
      status = next_status,
      stage_result = 'pending',
      stage_scheduled_at = null,
      stage_venue = null,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
    where id = target_application_id;
    insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note, result)
    values (target_application_id, caller_id, application_row.status, next_status, clean_note, target_result);
    message := case when target_result = 'passed' then 'You passed the ' || application_row.status || '. ' else '' end || private.application_status_message(next_status);
    if document_path is not null then
      insert into public.application_stage_documents (application_id, stage, result, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
      values (target_application_id, application_row.status, target_result, document_path, btrim(target_document ->> 'fileName'), target_document ->> 'mimeType', (target_document ->> 'sizeBytes')::integer, caller_id);
    end if;
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (recipient_profile_id, 'application_status_updated', 'Application updated', message || coalesce(' Note: ' || clean_note, ''), '/applicant/applications');
end;
$$;

create function public.record_stage_result(
  target_application_id uuid,
  target_result text,
  target_note text,
  target_document jsonb,
  target_scheduled_at timestamptz default null,
  target_venue text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_stage_result(target_application_id, target_result, target_note, target_document, target_scheduled_at, target_venue);
end;
$$;

revoke all on function private.record_stage_result(uuid, text, text, jsonb, timestamptz, text) from public, anon, authenticated;
revoke all on function public.record_stage_result(uuid, text, text, jsonb, timestamptz, text) from public, anon;
grant execute on function public.record_stage_result(uuid, text, text, jsonb, timestamptz, text) to authenticated;

create function public.delete_my_notification(target_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  delete from public.notifications notification
  where notification.id = target_notification_id and notification.recipient_user_id = current_user_id;
end;
$$;

create function public.delete_my_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  delete from public.notifications notification where notification.recipient_user_id = current_user_id;
end;
$$;

revoke all on function public.delete_my_notification(uuid) from public, anon;
revoke all on function public.delete_my_notifications() from public, anon;
grant execute on function public.delete_my_notification(uuid) to authenticated;
grant execute on function public.delete_my_notifications() to authenticated;
