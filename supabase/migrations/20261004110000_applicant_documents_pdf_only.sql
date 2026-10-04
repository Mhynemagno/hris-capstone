-- Tester feedback (2026-10-04): only the 2x2 picture is an image; the CV / Resume, PSA birth
-- certificate, Eligibility, and Diploma must be PDFs. Rows uploaded before this rule stay valid
-- (NOT VALID) until the applicant replaces them.

alter table public.applicant_profile_documents
  add constraint applicant_profile_documents_non_photo_is_pdf
    check (kind = 'photo' or mime_type = 'application/pdf') not valid;

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

  -- The PDF-only rule, with a message the applicant can act on.
  if target_kind in ('resume', 'psa', 'eligibility', 'diploma') and target_mime_type is distinct from 'application/pdf' then
    raise exception 'Upload the % as a PDF file.',
      case target_kind when 'resume' then 'CV / Resume' when 'psa' then 'PSA birth certificate' when 'eligibility' then 'Eligibility' else 'Diploma' end
      using errcode = '22023';
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
