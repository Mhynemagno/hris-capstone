-- Capstone UI HR redesign (PDF p. 23): Certification / Training entries carry one uploaded document, like Eligibility.

alter table public.certifications
  add column document_path text unique check (document_path is null or document_path ~ '^certifications/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$'),
  add column document_name text check (document_name is null or (document_name = btrim(document_name) and char_length(document_name) between 1 and 255)),
  add column document_mime_type text check (document_mime_type is null or document_mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  add column document_size_bytes integer check (document_size_bytes is null or document_size_bytes between 1 and 10485760),
  add constraint certifications_document_complete check ((document_path is null) = (document_name is null) and (document_path is null) = (document_mime_type is null) and (document_path is null) = (document_size_bytes is null));

create policy personnel_documents_upload_hr_certifications
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'personnel-documents'
    and (storage.foldername(name))[1] = 'certifications'
    and array_length(storage.foldername(name), 1) = 2
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

-- Replace / Remove must work when a different HR user uploaded the file.
create policy personnel_documents_delete_hr
  on storage.objects for delete to authenticated
  using (bucket_id = 'personnel-documents' and (select private.current_user_has_role('hr_personnel'::public.app_role)));

create function private.check_certification_document()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.document_path is not null
    and new.document_path is distinct from (case when tg_op = 'UPDATE' then old.document_path end)
    and (
      split_part(new.document_path, '/', 2) <> new.employee_id::text
      or not exists (select 1 from storage.objects where bucket_id = 'personnel-documents' and name = new.document_path)
    )
  then
    raise exception 'The supporting document was not uploaded.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.check_certification_document() from public, anon, authenticated;

create trigger certifications_check_document
  before insert or update of document_path on public.certifications
  for each row execute function private.check_certification_document();
