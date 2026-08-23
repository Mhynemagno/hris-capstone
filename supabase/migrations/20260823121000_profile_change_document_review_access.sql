-- Employees can read their own request documents; active system administrators
-- must also be able to open the evidence while reviewing a request.
create policy private_documents_profile_change_read_admin on storage.objects for select to authenticated using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'profile-change-requests'
  and (select private.current_user_has_role('system_administrator'::public.app_role))
  and exists (
    select 1
    from public.profile_change_request_documents document
    where document.object_path = name
  )
);

-- Public RPC wrappers are intentionally security definer because callers have no
-- execute grant on the private implementation. Pin their search path as well.
alter function public.submit_profile_change_request(uuid, text, jsonb, jsonb) set search_path = '';
alter function public.cancel_profile_change_request(uuid) set search_path = '';
alter function public.decide_profile_change_request(uuid, text, text) set search_path = '';

-- A removal request must preserve its immutable original snapshot after the
-- referenced qualification has been deleted on approval.
alter table public.profile_change_request_changes
  drop constraint profile_change_request_changes_qualification_id_fkey,
  add constraint profile_change_request_changes_qualification_id_fkey
    foreign key (qualification_id) references public.qualifications (id) on delete set null;

-- RLS, rather than missing table privileges, should enforce anonymous profile
-- denial so the authorization regression test exercises the intended boundary.
grant usage on schema public to anon;
grant select on public.profiles to anon;
