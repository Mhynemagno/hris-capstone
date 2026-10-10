-- Client round 5 (2026-10-10): supporting documents as proof.
--   * Eligibility: a supporting document showing the exam was passed (the form requires it for new and updated
--     entries; older records without one stay valid). Stored in the private personnel-documents bucket.
--   * Deployments: the deployed employee (or HR) submits a report / proof of attendance.
--   * Sick Leave requires a supporting document. submit_leave_request no longer checked requires_attachment
--     (dropped when allotments were added), so a deferred check now runs once the request and its attachments
--     are saved.

-- Eligibility documents -------------------------------------------------------------------------------------
alter table public.qualifications
  add column document_path text unique check (document_path is null or document_path ~ '^qualifications/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$'),
  add column document_name text check (document_name is null or (document_name = btrim(document_name) and char_length(document_name) between 1 and 255)),
  add column document_mime_type text check (document_mime_type is null or document_mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  add column document_size_bytes integer check (document_size_bytes is null or document_size_bytes between 1 and 10485760),
  add constraint qualifications_document_complete check ((document_path is null) = (document_name is null) and (document_path is null) = (document_mime_type is null) and (document_path is null) = (document_size_bytes is null));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('personnel-documents', 'personnel-documents', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy personnel_documents_upload_hr
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'personnel-documents'
    and (storage.foldername(name))[1] = 'qualifications'
    and array_length(storage.foldername(name), 1) = 2
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create policy personnel_documents_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'personnel-documents'
    and (
      (select private.current_user_has_role('hr_personnel'::public.app_role))
      or exists (select 1 from public.employees employee where employee.profile_id = (select auth.uid()) and employee.id::text = (storage.foldername(name))[2])
    )
  );

-- The uploader can remove their own file when saving the eligibility fails (clean-up in the app).
create policy personnel_documents_delete_own_upload
  on storage.objects for delete to authenticated
  using (bucket_id = 'personnel-documents' and owner_id = (select auth.uid())::text);

create function private.check_qualification_document()
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

create trigger qualifications_check_document
  before insert or update of document_path on public.qualifications
  for each row execute function private.check_qualification_document();

-- Deployment reports ----------------------------------------------------------------------------------------
create table public.deployment_reports (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  notes text check (notes is null or (notes = btrim(notes) and char_length(notes) <= 2000)),
  object_path text not null unique check (object_path ~ '^deployments/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$'),
  file_name text not null check (file_name = btrim(file_name) and char_length(file_name) between 1 and 255 and file_name !~ '[\\/[:cntrl:]]'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  submitted_by_user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index deployment_reports_deployment_idx on public.deployment_reports (deployment_id, created_at);

alter table public.deployment_reports enable row level security;

create function private.can_access_deployment(target_deployment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.current_user_has_role('hr_personnel'::public.app_role))
    or exists (
      select 1 from public.deployments deployment
      join public.employees employee on employee.id = deployment.employee_id
      where deployment.id = target_deployment_id and employee.profile_id = (select auth.uid())
    );
$$;

create policy deployment_reports_select
  on public.deployment_reports for select to authenticated
  using ((select private.can_access_deployment(deployment_id)));

revoke all on public.deployment_reports from anon, authenticated;
grant select on public.deployment_reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deployment-reports', 'deployment-reports', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy deployment_reports_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deployment-reports'
    and (storage.foldername(name))[1] = 'deployments'
    and array_length(storage.foldername(name), 1) = 2
    and (select private.can_access_deployment(((storage.foldername(name))[2])::uuid))
  );

create policy deployment_reports_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'deployment-reports'
    and (select private.can_access_deployment(((storage.foldername(name))[2])::uuid))
  );

-- The uploader can remove their own file when the report is refused (clean-up in the app).
create policy deployment_reports_delete_own_upload
  on storage.objects for delete to authenticated
  using (bucket_id = 'deployment-reports' and owner_id = (select auth.uid())::text);

create function public.submit_deployment_report(target_deployment_id uuid, target_notes text, target_document jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  clean_notes text := nullif(btrim(target_notes), '');
  document_path text := target_document ->> 'objectPath';
  new_report_id uuid;
begin
  if caller_id is null or not exists (select 1 from public.deployments where id = target_deployment_id) or not private.can_access_deployment(target_deployment_id) then
    raise exception 'You can only report on your own deployment.' using errcode = '42501';
  end if;
  if target_document is null or jsonb_typeof(target_document) <> 'object' then
    raise exception 'Attach the report or proof of attendance.' using errcode = '22023';
  end if;
  if document_path is null
    or document_path !~ ('^deployments/' || target_deployment_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$')
    or not exists (select 1 from storage.objects where bucket_id = 'deployment-reports' and name = document_path)
  then
    raise exception 'The report file was not uploaded.' using errcode = '22023';
  end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then
    raise exception 'Notes must be at most 2000 characters.' using errcode = '22023';
  end if;
  insert into public.deployment_reports (deployment_id, notes, object_path, file_name, mime_type, size_bytes, submitted_by_user_id)
  values (target_deployment_id, clean_notes, document_path, btrim(target_document ->> 'fileName'), target_document ->> 'mimeType', (target_document ->> 'sizeBytes')::integer, caller_id)
  returning id into new_report_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', target_deployment_id::text, 'report_submitted', jsonb_build_object('report_id', new_report_id));
  return new_report_id;
end;
$$;

-- Sick Leave supporting documents ---------------------------------------------------------------------------
update public.leave_types set requires_attachment = true, updated_at = now() where lower(name) = 'sick leave';

create function private.require_leave_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  type_row public.leave_types%rowtype;
begin
  select * into type_row from public.leave_types where id = new.leave_type_id;
  if type_row.requires_attachment and not exists (select 1 from public.leave_request_attachments where request_id = new.id) then
    raise exception 'Attach a supporting document for %.', type_row.name using errcode = '22023';
  end if;
  return null;
end;
$$;

create constraint trigger leave_requests_require_attachment
  after insert on public.leave_requests
  deferrable initially deferred
  for each row execute function private.require_leave_attachment();

revoke all on function private.check_qualification_document(), private.require_leave_attachment() from public, anon, authenticated;
-- Row and storage policies call this as the signed-in user.
revoke all on function private.can_access_deployment(uuid) from public, anon;
grant execute on function private.can_access_deployment(uuid) to authenticated;
revoke all on function public.submit_deployment_report(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_deployment_report(uuid, text, jsonb) to authenticated;
