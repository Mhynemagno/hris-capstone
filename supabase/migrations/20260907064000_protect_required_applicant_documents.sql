grant usage on sequence public.applicant_number_seq to authenticated;

drop policy applicant_profile_documents_delete_own on storage.objects;
create policy applicant_profile_documents_delete_unreferenced_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'applicant-profile-documents'
    and name like 'applicant-profiles/' || (select auth.uid())::text || '/%'
    and not exists (
      select 1
      from public.applicant_profile_documents document
      where document.object_path = name
    )
  );
