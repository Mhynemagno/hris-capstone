-- Client round 5 (2026-10-10): HR records each stage's result instead of "Move to next stage" / "Not selected".
--   * Results: Verified (Application Submission documents checked), Scheduled (a test or interview is set),
--     Passed (moves to the next stage; at Final Evaluation the applicant becomes a Candidate = Shortlisted),
--     Failed (ends the application as Not Selected = Disqualified). Failing is allowed at any stage.
--   * Passing or failing a stage after Application Submission needs a supporting document uploaded by HR
--     (proof the stage was carried out), kept in application_stage_documents.
--   * applications.stage_result holds Pending / For Evaluation, Verified or Scheduled for the current stage.

alter table public.applications
  add column stage_result text not null default 'pending' check (stage_result in ('pending', 'verified', 'scheduled'));

alter table public.application_status_history
  add column result text check (result is null or result in ('verified', 'scheduled', 'passed', 'failed'));

create table public.application_stage_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  stage text not null check (stage in (
    'Application Submission', 'Physical Agility Test', 'Physical & Medical Examination',
    'Neuro-Psychiatric Examination', 'Drug Test', 'Character & Background Investigation',
    'Panel Interview', 'Final Evaluation'
  )),
  result text not null check (result in ('passed', 'failed')),
  object_path text not null unique check (object_path ~ '^applications/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$'),
  file_name text not null check (file_name = btrim(file_name) and char_length(file_name) between 1 and 255 and file_name !~ '[\\/[:cntrl:]]'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by_user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index application_stage_documents_application_idx on public.application_stage_documents (application_id, created_at);

alter table public.application_stage_documents enable row level security;

create policy application_stage_documents_select_hr
  on public.application_stage_documents for select to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

revoke all on public.application_stage_documents from anon, authenticated;
grant select on public.application_stage_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recruitment-stage-documents', 'recruitment-stage-documents', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy recruitment_stage_documents_upload_hr
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recruitment-stage-documents'
    and (storage.foldername(name))[1] = 'applications'
    and array_length(storage.foldername(name), 1) = 2
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create policy recruitment_stage_documents_read_hr
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recruitment-stage-documents'
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create function private.record_stage_result(target_application_id uuid, target_result text, target_note text, target_document jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  application_row public.applications%rowtype;
  recipient_profile_id uuid;
  clean_note text := nullif(btrim(target_note), '');
  next_status text;
  document_path text;
  needs_document boolean;
  message text;
begin
  select * into application_row from public.applications where id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status not in (
    'Application Submission', 'Physical Agility Test', 'Physical & Medical Examination', 'Neuro-Psychiatric Examination',
    'Drug Test', 'Character & Background Investigation', 'Panel Interview', 'Final Evaluation'
  ) then raise exception 'This application is no longer in the recruitment process.' using errcode = '22023'; end if;
  if target_result not in ('verified', 'scheduled', 'passed', 'failed') then raise exception 'Choose a valid result.' using errcode = '22023'; end if;
  if target_result = 'verified' and application_row.status <> 'Application Submission' then raise exception 'Verified applies only to Application Submission.' using errcode = '22023'; end if;
  if target_result = 'scheduled' and application_row.status = 'Application Submission' then raise exception 'Application Submission is verified, not scheduled.' using errcode = '22023'; end if;
  if clean_note is not null and char_length(clean_note) > 2000 then raise exception 'Notes must be at most 2000 characters.' using errcode = '22023'; end if;
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
    update public.applications set stage_result = target_result, reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
    insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note, result)
    values (target_application_id, caller_id, application_row.status, application_row.status, clean_note, target_result);
    message := case when target_result = 'verified' then 'Your submitted documents have been verified.' else 'You are scheduled for the ' || application_row.status || '.' end;
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
    update public.applications set status = next_status, stage_result = 'pending', reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
    insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note, result)
    values (target_application_id, caller_id, application_row.status, next_status, clean_note, target_result);
    message := case when target_result = 'passed' then 'You passed the ' || application_row.status || '. ' else '' end || private.application_status_message(next_status);
    if document_path is not null then
      insert into public.application_stage_documents (application_id, stage, result, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
      values (target_application_id, application_row.status, target_result, document_path, btrim(target_document ->> 'fileName'), target_document ->> 'mimeType', (target_document ->> 'sizeBytes')::integer, caller_id);
    end if;
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (recipient_profile_id, 'application_status_updated', 'Application updated', message || coalesce(' Note: ' || clean_note, ''), '/applicant/applications/' || target_application_id::text);
end;
$$;

create function public.record_stage_result(target_application_id uuid, target_result text, target_note text, target_document jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_stage_result(target_application_id, target_result, target_note, target_document);
end;
$$;

revoke all on function private.record_stage_result(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_stage_result(uuid, text, text, jsonb) from public, anon;
grant execute on function public.record_stage_result(uuid, text, text, jsonb) to authenticated;
