-- Evidence belongs to the deployed employee. HR may review it, but cannot submit it on their behalf.
drop policy deployment_reports_upload on storage.objects;
create policy deployment_reports_upload_employee_only
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deployment-reports'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = 'deployments'
    and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.deployments deployment
      join public.employees employee on employee.id = deployment.employee_id
      where deployment.id = ((storage.foldername(name))[2])::uuid
        and employee.profile_id = (select auth.uid())
    )
  );

create or replace function public.submit_deployment_report(target_deployment_id uuid, target_notes text, target_document jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  clean_notes text := nullif(btrim(target_notes), '');
  document_path text := target_document ->> 'objectPath';
  new_report_id uuid;
begin
  if caller_id is null or not exists (
    select 1 from public.deployments deployment
    join public.employees employee on employee.id = deployment.employee_id
    where deployment.id = target_deployment_id and employee.profile_id = caller_id
  ) then
    raise exception 'Only the assigned employee can submit deployment evidence.' using errcode = '42501';
  end if;
  if target_document is null or jsonb_typeof(target_document) <> 'object' then raise exception 'Attach the report or proof of attendance.' using errcode = '22023'; end if;
  if document_path is null or document_path !~ ('^deployments/' || target_deployment_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$') or not exists (select 1 from storage.objects where bucket_id = 'deployment-reports' and name = document_path) then raise exception 'The report file was not uploaded.' using errcode = '22023'; end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Notes must be at most 2000 characters.' using errcode = '22023'; end if;
  insert into public.deployment_reports (deployment_id, notes, object_path, file_name, mime_type, size_bytes, submitted_by_user_id)
  values (target_deployment_id, clean_notes, document_path, btrim(target_document ->> 'fileName'), target_document ->> 'mimeType', (target_document ->> 'sizeBytes')::integer, caller_id)
  returning id into new_report_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', target_deployment_id::text, 'report_submitted', jsonb_build_object('report_id', new_report_id));
  return new_report_id;
end;
$$;
