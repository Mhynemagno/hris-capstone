-- Final Revisions PDF (2026-10-22): leave over the available credits.
--
-- Any leave type may now go beyond its yearly allotment, not only the types flagged
-- excess_deducted_from_retirement. The employee first confirms "Would you like to proceed?" in the
-- request form, and the RPC requires that confirmation explicitly (target_accept_deduction). The days
-- beyond the remaining credits are stored in leave_requests.excess_days as deduction days, so HR and
-- the employee can see them. Types without a yearly limit never have excess days.
--
-- The RPC gains a parameter, so the old six-argument functions are dropped and replaced. The new
-- parameter defaults to false, so a request that fits the remaining credits needs no change.

drop function if exists public.submit_leave_request(uuid, uuid, date, date, text, jsonb);
drop function if exists private.submit_leave_request(uuid, uuid, date, date, text, jsonb);

create function private.submit_leave_request(target_request_id uuid, target_leave_type_id uuid, target_starts_on date, target_ends_on date, request_reason text, requested_attachments jsonb, target_accept_deduction boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); target_employee_id uuid; type_row public.leave_types%rowtype; attachment jsonb; attachment_path text; clean_notes text := nullif(btrim(coalesce(request_reason, '')), '');
  requested_days integer; used_days integer; remaining_days integer; request_excess integer := 0;
begin
  if caller_id is null or not (select private.current_user_has_role('employee'::public.app_role)) then raise exception 'Employee access is required.' using errcode = '42501'; end if;
  -- Locking the employee row serializes an employee's submissions, so two requests cannot both fit the same remaining days.
  select id into target_employee_id from public.employees where profile_id = caller_id for update;
  if target_employee_id is null then raise exception 'Employee record was not found.' using errcode = 'P0001'; end if;
  select * into type_row from public.leave_types where id = target_leave_type_id and is_active for share;
  if not found then raise exception 'Leave type is not active.' using errcode = 'P0001'; end if;
  if target_starts_on < current_date or target_ends_on < target_starts_on then raise exception 'Choose an inclusive current or future leave range.' using errcode = '22007'; end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Leave notes must be 2000 characters or fewer.' using errcode = '22023'; end if;
  if type_row.days_per_year is not null then
    requested_days := target_ends_on - target_starts_on + 1;
    used_days := private.leave_days_used(target_employee_id, type_row.id, extract(year from target_starts_on)::integer);
    remaining_days := greatest(type_row.days_per_year - used_days, 0);
    if requested_days > remaining_days then
      request_excess := requested_days - remaining_days;
      if not coalesce(target_accept_deduction, false) then
        raise exception 'You do not have enough % credits for %. Confirm that the % excess % will be deducted to proceed.', type_row.name, extract(year from target_starts_on)::integer, request_excess, case when request_excess = 1 then 'day' else 'days' end using errcode = '22023';
      end if;
    end if;
  end if;
  requested_attachments := coalesce(requested_attachments, '[]'::jsonb);
  if jsonb_typeof(requested_attachments) <> 'array' or jsonb_array_length(requested_attachments) > 10 then raise exception 'Invalid leave attachments.' using errcode = '22023'; end if;
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    attachment_path := attachment ->> 'objectPath';
    if attachment_path is null or attachment_path !~ ('^leave-requests/' || caller_id::text || '/' || target_request_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$') or attachment ->> 'fileName' !~ '^[^\\/[:cntrl:]]{1,255}$' or attachment ->> 'mimeType' not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') or coalesce((attachment ->> 'sizeBytes')::integer, 0) not between 1 and 10485760 or not exists (select 1 from storage.objects object where object.bucket_id = 'private-documents' and object.name = attachment_path and object.owner_id = caller_id::text) then
      raise exception 'Invalid leave attachment.' using errcode = '22023';
    end if;
  end loop;
  insert into public.leave_requests (id, employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on, reason, excess_days)
  values (target_request_id, target_employee_id, caller_id, type_row.id, type_row.name, target_starts_on, target_ends_on, clean_notes, request_excess);
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    insert into public.leave_request_attachments (request_id, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (target_request_id, attachment ->> 'objectPath', btrim(attachment ->> 'fileName'), attachment ->> 'mimeType', (attachment ->> 'sizeBytes')::integer, caller_id);
  end loop;
  insert into public.leave_request_history (request_id, actor_user_id, event_type, metadata)
  values (target_request_id, caller_id, 'submitted', case when request_excess > 0 then jsonb_build_object('excess_days', request_excess) else '{}'::jsonb end);
end;
$$;

create function public.submit_leave_request(target_request_id uuid, target_leave_type_id uuid, target_starts_on date, target_ends_on date, request_reason text, requested_attachments jsonb, target_accept_deduction boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.submit_leave_request(target_request_id, target_leave_type_id, target_starts_on, target_ends_on, request_reason, requested_attachments, target_accept_deduction);
end;
$$;

revoke all on function private.submit_leave_request(uuid, uuid, date, date, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.submit_leave_request(uuid, uuid, date, date, text, jsonb, boolean) from public, anon;
grant execute on function public.submit_leave_request(uuid, uuid, date, date, text, jsonb, boolean) to authenticated;

comment on column public.leave_requests.excess_days is 'Days of this request beyond the remaining yearly credits, confirmed by the employee and recorded as deduction days.';
