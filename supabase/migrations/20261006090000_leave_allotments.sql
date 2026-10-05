-- Client consultation (2026-10-06): yearly leave allotments.
--
-- 1. Vacation Leave is removed (deactivated, so past requests keep their type).
-- 2. Each leave type can carry a yearly allotment in days. Mandatory Leave is 2 days, Maternity
--    Leave 105 days (RA 11210), Paternity Leave 7 days and Sick Leave 20 days. Once an allotment is
--    used up the employee can no longer apply for that type that year.
-- 3. A type can instead allow days beyond its allotment, which are deducted from the employee's
--    retirement benefits. Paternity Leave works this way; the request records how many days are
--    beyond the allotment so HR and the employee can see it.
--
-- Days are calendar days, inclusive. A request counts toward the year it starts in, and requests
-- that are for approval or approved both count, so an employee cannot queue requests past the limit.

alter table public.leave_types
  add column days_per_year integer check (days_per_year is null or days_per_year between 1 and 366),
  add column excess_deducted_from_retirement boolean not null default false;

alter table public.leave_requests
  add column excess_days integer not null default 0 check (excess_days >= 0);

update public.leave_types set is_active = false, updated_at = now() where lower(name) = 'vacation leave' and is_active;
update public.leave_types set days_per_year = 20 where lower(name) = 'sick leave' and days_per_year is null;
update public.leave_types set days_per_year = 2 where lower(name) = 'mandatory leave' and days_per_year is null;
update public.leave_types set days_per_year = 105 where lower(name) = 'maternity leave' and days_per_year is null;
update public.leave_types set days_per_year = 7, excess_deducted_from_retirement = true where lower(name) = 'paternity leave' and days_per_year is null;

-- Days of a type an employee has used (for approval or approved) in a calendar year.
create or replace function private.leave_days_used(target_employee_id uuid, target_leave_type_id uuid, target_year integer)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(request.ends_on - request.starts_on + 1), 0)::integer
  from public.leave_requests request
  where request.employee_id = target_employee_id
    and request.leave_type_id = target_leave_type_id
    and request.status in ('pending', 'approved')
    and extract(year from request.starts_on)::integer = target_year;
$$;

create or replace function private.submit_leave_request(target_request_id uuid, target_leave_type_id uuid, target_starts_on date, target_ends_on date, request_reason text, requested_attachments jsonb)
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
      if not type_row.excess_deducted_from_retirement then
        if remaining_days = 0 then
          raise exception 'You have already used all % % days for %.', type_row.days_per_year, type_row.name, extract(year from target_starts_on)::integer using errcode = '22023';
        end if;
        raise exception 'You have % % % left for %. Shorten the request to fit.', remaining_days, type_row.name, case when remaining_days = 1 then 'day' else 'days' end, extract(year from target_starts_on)::integer using errcode = '22023';
      end if;
      request_excess := requested_days - remaining_days;
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
  insert into public.leave_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'submitted');
end;
$$;

-- "Pending" is shown as "For Approval" everywhere, so the messages say the same.
create or replace function private.cancel_leave_request(target_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); request_row public.leave_requests%rowtype;
begin
  select * into request_row from public.leave_requests where id = target_request_id for update;
  if not found or request_row.submitted_by_user_id <> caller_id or request_row.status <> 'pending' then raise exception 'Only the owning employee can cancel a leave request that is for approval.' using errcode = '42501'; end if;
  update public.leave_requests set status = 'cancelled', updated_at = now() where id = target_request_id;
  insert into public.leave_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'cancelled');
end;
$$;

create or replace function private.decide_leave_request(target_request_id uuid, requested_decision text, requested_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); request_row public.leave_requests%rowtype; clean_note text := nullif(btrim(requested_note), '');
begin
  if requested_decision not in ('approved', 'rejected') or (requested_decision = 'rejected' and clean_note is null) then raise exception 'A reason is required when rejecting a leave request.' using errcode = '22023'; end if;
  select * into request_row from public.leave_requests where id = target_request_id for update;
  if not found or request_row.status <> 'pending' then raise exception 'Leave request is no longer for approval.' using errcode = 'P0001'; end if;
  update public.leave_requests set status = requested_decision, decision_note = clean_note, decided_by_user_id = caller_id, decided_at = now(), updated_at = now() where id = target_request_id;
  insert into public.leave_request_history (request_id, actor_user_id, event_type, metadata) values (target_request_id, caller_id, requested_decision, jsonb_build_object('note', clean_note));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'leave_requests', target_request_id::text, requested_decision, jsonb_build_object('employee_id', request_row.employee_id));
  insert into public.notifications (recipient_user_id, type, title, body, link) values (request_row.submitted_by_user_id, 'leave_request_decision', 'Leave request ' || requested_decision, case when requested_decision = 'approved' then 'Your leave request was approved.' else 'Your leave request was rejected.' end, '/employee/leave');
end;
$$;

-- HR sets a type's allotment separately from its name and description, so the existing RPCs keep their signatures.
create or replace function private.set_leave_type_allotment(target_type_id uuid, type_days_per_year integer, type_excess_deducted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr();
begin
  if type_days_per_year is not null and type_days_per_year not between 1 and 366 then raise exception 'Days per year must be between 1 and 366.' using errcode = '22023'; end if;
  if type_days_per_year is null and coalesce(type_excess_deducted, false) then raise exception 'Set the days per year before allowing extra days.' using errcode = '22023'; end if;
  update public.leave_types set days_per_year = type_days_per_year, excess_deducted_from_retirement = coalesce(type_excess_deducted, false), updated_by_user_id = caller_id, updated_at = now() where id = target_type_id;
  if not found then raise exception 'Leave type was not found.' using errcode = 'P0001'; end if;
end;
$$;

-- The caller's used days per active leave type for a year, for the request form.
create or replace function private.get_my_leave_balances(target_year integer)
returns table (leave_type_id uuid, days_per_year integer, excess_deducted_from_retirement boolean, used_days integer)
language plpgsql stable security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); target_employee_id uuid;
begin
  if caller_id is null or not (select private.current_user_has_role('employee'::public.app_role)) then raise exception 'Employee access is required.' using errcode = '42501'; end if;
  select id into target_employee_id from public.employees where profile_id = caller_id;
  if target_employee_id is null then raise exception 'Employee record was not found.' using errcode = 'P0001'; end if;
  return query
    select type.id, type.days_per_year, type.excess_deducted_from_retirement, private.leave_days_used(target_employee_id, type.id, target_year)
    from public.leave_types type
    where type.is_active;
end;
$$;

create or replace function public.set_leave_type_allotment(target_type_id uuid, type_days_per_year integer, type_excess_deducted boolean) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.set_leave_type_allotment(target_type_id, type_days_per_year, type_excess_deducted); end; $$;
create or replace function public.get_my_leave_balances(target_year integer)
returns table (leave_type_id uuid, days_per_year integer, excess_deducted_from_retirement boolean, used_days integer)
language plpgsql stable security definer set search_path = '' as $$ begin return query select * from private.get_my_leave_balances(target_year); end; $$;

revoke all on function private.leave_days_used(uuid, uuid, integer), private.set_leave_type_allotment(uuid, integer, boolean), private.get_my_leave_balances(integer) from public, anon, authenticated;
revoke all on function private.submit_leave_request(uuid, uuid, date, date, text, jsonb), private.cancel_leave_request(uuid), private.decide_leave_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_leave_type_allotment(uuid, integer, boolean), public.get_my_leave_balances(integer) from public, anon;
grant execute on function public.set_leave_type_allotment(uuid, integer, boolean), public.get_my_leave_balances(integer) to authenticated;
