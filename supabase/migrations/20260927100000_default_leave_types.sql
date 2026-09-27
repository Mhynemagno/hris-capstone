-- Default leave types and optional leave notes (tester feedback).
--
-- 1. The leave-type dropdown was empty on a fresh database. Seed the standard leave types as
--    system-provided rows. A migration runs before any profile exists, so the audit columns
--    become nullable (null = provided by the system rather than by an HR user).
-- 2. The request form's "Reason" field is now optional "Notes": the column accepts null and the
--    RPC stores blank notes as null.
-- 3. The request form no longer uploads supporting evidence, so the RPC no longer rejects
--    requests without attachments (attachments are still accepted and validated when sent).

alter table public.leave_types alter column created_by_user_id drop not null;
alter table public.leave_types alter column updated_by_user_id drop not null;

insert into public.leave_types (name, requires_attachment, is_active)
select defaults.name, false, true
from (values ('Vacation Leave'), ('Sick Leave'), ('Mandatory Leave'), ('Maternity Leave'), ('Paternity Leave')) as defaults(name)
where not exists (select 1 from public.leave_types existing where lower(existing.name) = lower(defaults.name));

alter table public.leave_requests alter column reason drop not null;
alter table public.leave_requests drop constraint if exists leave_requests_reason_check;
alter table public.leave_requests add constraint leave_requests_reason_check
  check (reason is null or (reason = btrim(reason) and char_length(reason) between 1 and 2000));

create or replace function private.submit_leave_request(target_request_id uuid, target_leave_type_id uuid, target_starts_on date, target_ends_on date, request_reason text, requested_attachments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); target_employee_id uuid; type_row public.leave_types%rowtype; attachment jsonb; attachment_path text; clean_notes text := nullif(btrim(coalesce(request_reason, '')), '');
begin
  if caller_id is null or not (select private.current_user_has_role('employee'::public.app_role)) then raise exception 'Employee access is required.' using errcode = '42501'; end if;
  select id into target_employee_id from public.employees where profile_id = caller_id;
  if target_employee_id is null then raise exception 'Employee record was not found.' using errcode = 'P0001'; end if;
  select * into type_row from public.leave_types where id = target_leave_type_id and is_active for share;
  if not found then raise exception 'Leave type is not active.' using errcode = 'P0001'; end if;
  if target_starts_on < current_date or target_ends_on < target_starts_on then raise exception 'Choose an inclusive current or future leave range.' using errcode = '22007'; end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Leave notes must be 2000 characters or fewer.' using errcode = '22023'; end if;
  requested_attachments := coalesce(requested_attachments, '[]'::jsonb);
  if jsonb_typeof(requested_attachments) <> 'array' or jsonb_array_length(requested_attachments) > 10 then raise exception 'Invalid leave attachments.' using errcode = '22023'; end if;
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    attachment_path := attachment ->> 'objectPath';
    if attachment_path is null or attachment_path !~ ('^leave-requests/' || caller_id::text || '/' || target_request_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$') or attachment ->> 'fileName' !~ '^[^\\/[:cntrl:]]{1,255}$' or attachment ->> 'mimeType' not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') or coalesce((attachment ->> 'sizeBytes')::integer, 0) not between 1 and 10485760 or not exists (select 1 from storage.objects object where object.bucket_id = 'private-documents' and object.name = attachment_path and object.owner_id = caller_id::text) then
      raise exception 'Invalid leave attachment.' using errcode = '22023';
    end if;
  end loop;
  insert into public.leave_requests (id, employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on, reason)
  values (target_request_id, target_employee_id, caller_id, type_row.id, type_row.name, target_starts_on, target_ends_on, clean_notes);
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    insert into public.leave_request_attachments (request_id, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (target_request_id, attachment ->> 'objectPath', btrim(attachment ->> 'fileName'), attachment ->> 'mimeType', (attachment ->> 'sizeBytes')::integer, caller_id);
  end loop;
  insert into public.leave_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'submitted');
end;
$$;

revoke all on function private.submit_leave_request(uuid, uuid, date, date, text, jsonb) from public, anon, authenticated;
