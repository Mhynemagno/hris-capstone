-- The applicant Documents page now requires five documents before applying:
-- Eligibility, Diploma, CV / Resume (resume), PSA birth certificate (psa), and a 2x2 picture (photo).
-- The 2x2 picture must be an image (PNG or JPEG); the other documents may be PDF, PNG, or JPEG.
-- Existing Eligibility / Diploma rows are untouched; applicants upload the new ones before their
-- next application.

alter table public.applicant_profile_documents
  drop constraint applicant_profile_documents_kind_check,
  add constraint applicant_profile_documents_kind_check
    check (kind in ('eligibility', 'diploma', 'resume', 'psa', 'photo')),
  add constraint applicant_profile_documents_photo_is_image
    check (kind <> 'photo' or mime_type in ('image/png', 'image/jpeg'));

create or replace function public.save_my_applicant_profile_document(
  target_kind text,
  target_object_path text,
  target_file_name text,
  target_mime_type text,
  target_size_bytes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_applicant_id uuid;
begin
  select applicant.id
  into caller_applicant_id
  from public.applicants applicant
  where applicant.profile_id = caller_id;

  if caller_applicant_id is null then
    raise exception 'Only an applicant can save profile documents.' using errcode = '42501';
  end if;

  if target_kind is null
    or target_kind not in ('eligibility', 'diploma', 'resume', 'psa', 'photo')
    or target_object_path !~ (
      '^applicant-profiles/' || caller_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$'
    )
    or target_file_name !~ '^[^\\/[:cntrl:]]{1,255}$'
    or target_mime_type not in ('application/pdf', 'image/png', 'image/jpeg')
    or (target_kind = 'photo' and target_mime_type not in ('image/png', 'image/jpeg'))
    or target_size_bytes not between 1 and 10485760
    or not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'applicant-profile-documents'
        and object.name = target_object_path
        and object.owner_id = caller_id::text
    ) then
    raise exception 'Invalid applicant profile document.' using errcode = '22023';
  end if;

  insert into public.applicant_profile_documents (
    applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id
  ) values (
    caller_applicant_id, target_kind, target_object_path, target_file_name,
    target_mime_type, target_size_bytes, caller_id
  )
  on conflict (applicant_id, kind) do update
  set object_path = excluded.object_path,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      uploaded_by_user_id = excluded.uploaded_by_user_id,
      updated_at = clock_timestamp();
end;
$$;

revoke all on function public.save_my_applicant_profile_document(text, text, text, text, integer) from public, anon;
grant execute on function public.save_my_applicant_profile_document(text, text, text, text, integer) to authenticated;

create or replace function public.remove_my_applicant_profile_document(target_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_applicant_id uuid;
  removed_path text;
begin
  select applicant.id into caller_applicant_id
  from public.applicants applicant
  where applicant.profile_id = caller_id;

  if caller_applicant_id is null then
    raise exception 'Only an applicant can remove profile documents.' using errcode = '42501';
  end if;

  if target_kind is null or target_kind not in ('eligibility', 'diploma', 'resume', 'psa', 'photo') then
    raise exception 'Invalid applicant profile document.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.applications application
    where application.applicant_id = caller_applicant_id
      and application.status not in ('Hired', 'Not Selected')
  ) then
    raise exception 'This document is under review for an application in progress. Upload a replacement instead of removing it.' using errcode = 'P0001';
  end if;

  delete from public.applicant_profile_documents document
  where document.applicant_id = caller_applicant_id and document.kind = target_kind
  returning document.object_path into removed_path;

  if removed_path is null then
    raise exception 'The document was not found.' using errcode = 'P0002';
  end if;

  return removed_path;
end;
$$;

revoke all on function public.remove_my_applicant_profile_document(text) from public, anon;
grant execute on function public.remove_my_applicant_profile_document(text) to authenticated;

-- Same body as 20260907050000_require_applicant_profile_documents.sql, now requiring all five
-- profile documents. The message still names "eligibility" and "diploma" so the client keeps
-- classifying it as a Documents-page requirement.
create or replace function private.submit_application(
  target_application_id uuid,
  target_job_opening_id bigint,
  submitted_cover_note text,
  submitted_documents jsonb
)
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

  if (select count(distinct profile_document.kind) from public.applicant_profile_documents profile_document where profile_document.applicant_id = target_applicant_id and profile_document.kind in ('eligibility', 'diploma', 'resume', 'psa', 'photo')) <> 5 then
    raise exception 'Upload your eligibility, diploma, CV / resume, PSA birth certificate, and 2x2 picture before applying.' using errcode = '42501';
  end if;

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
  insert into public.application_status_history (application_id, actor_user_id, next_status, note) values (target_application_id, caller_id, 'Submitted', null);
  return target_application_id;
end;
$$;
