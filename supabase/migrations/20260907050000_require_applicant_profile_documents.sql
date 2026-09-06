-- An applicant must provide these identity records before opening a job application.
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

  if (select count(distinct profile_document.kind) from public.applicant_profile_documents profile_document where profile_document.applicant_id = target_applicant_id and profile_document.kind in ('eligibility', 'diploma')) <> 2 then
    raise exception 'Upload your eligibility and diploma documents before applying.' using errcode = '42501';
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
