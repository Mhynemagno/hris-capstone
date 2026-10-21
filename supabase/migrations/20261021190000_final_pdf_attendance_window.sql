-- The early scan window is distinct from the scheduled start used for tardiness.
alter table public.attendance_integration_settings
  add column access_window_start time not null default time '05:00';

alter table public.attendance_integration_settings
  alter column workday_start set default time '08:00';

update public.attendance_integration_settings
set access_window_start = time '05:00',
    workday_start = time '08:00',
    updated_at = now()
where adapter_key in ('csv_xlsx', 'face_recognition');

create or replace function private.attendance_time_in_is_accepted(target_time_in timestamptz, target_access_window_start time, target_timezone text)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((target_time_in at time zone target_timezone)::time >= target_access_window_start, false);
$$;

create or replace function private.process_attendance_event(target_import_id uuid, target_external_employee_id text, target_source_event_id text, target_attendance_date date, target_time_in timestamptz, target_time_out timestamptz, target_event_type text, target_metadata jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  setting_row public.attendance_integration_settings%rowtype;
  mapping_row public.attendance_identity_mappings%rowtype;
  result_status text;
  clean_external text := upper(btrim(target_external_employee_id));
  clean_event text := btrim(target_source_event_id);
begin
  select * into setting_row from public.attendance_integration_settings where adapter_key = 'csv_xlsx' for share;
  if not found or not setting_row.is_enabled then raise exception 'Attendance import is unavailable.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.attendance_imports where id = target_import_id) then raise exception 'Attendance import was not found.' using errcode = 'P0001'; end if;
  if clean_external is null or char_length(clean_external) not between 1 and 64 or clean_event is null or char_length(clean_event) not between 1 and 128 or target_event_type not in ('attendance', 'absence') or jsonb_typeof(target_metadata) <> 'object' or exists (select 1 from jsonb_object_keys(target_metadata) key where key not in ('adapterVersion', 'templateVersion', 'rowNumber', 'checksum')) then raise exception 'Attendance event is invalid.' using errcode = '22023'; end if;
  if (target_event_type = 'absence' and (target_time_in is not null or target_time_out is not null)) or (target_event_type = 'attendance' and target_time_in is null) or (target_time_out is not null and target_time_out < target_time_in) then raise exception 'Attendance event times are invalid.' using errcode = '22007'; end if;
  if target_event_type = 'attendance' and not private.attendance_time_in_is_accepted(target_time_in, setting_row.access_window_start, setting_row.timezone) then raise exception 'Attendance time-in is before the 05:00 access window.' using errcode = '22007'; end if;
  if exists (select 1 from public.attendance_logs where integration_id = setting_row.id and source_event_id = clean_event) or exists (select 1 from public.attendance_unmatched_events where integration_id = setting_row.id and source_event_id = clean_event) then return 'duplicate'; end if;
  select * into mapping_row from public.attendance_identity_mappings where external_employee_id = clean_external for share;
  if not found then
    insert into public.attendance_unmatched_events (integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, event_type, import_id, sync_metadata)
    values (setting_row.id, clean_event, clean_external, target_attendance_date, target_time_in, target_time_out, target_event_type, target_import_id, target_metadata);
    update public.attendance_imports set unmatched_count = unmatched_count + 1 where id = target_import_id;
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_unmatched_events', clean_event, 'queued', jsonb_build_object('external_employee_id', clean_external));
    return 'unmatched';
  end if;
  result_status := case when target_event_type = 'absence' then 'absent' when target_time_out is null then 'incomplete' when private.attendance_time_in_is_late(target_time_in, setting_row.workday_start, setting_row.late_grace_minutes, setting_row.timezone) then 'late' else 'present' end;
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, sync_metadata)
  values (mapping_row.employee_id, setting_row.id, clean_event, clean_external, target_attendance_date, target_time_in, target_time_out, result_status, target_import_id, target_metadata);
  update public.attendance_imports set accepted_count = accepted_count + 1 where id = target_import_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_logs', clean_event, 'imported', jsonb_build_object('employee_id', mapping_row.employee_id, 'status', result_status));
  return 'inserted';
end;
$$;

create or replace function private.resolve_attendance_unmatched_event(target_unmatched_event_id uuid, target_employee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr(); event_row public.attendance_unmatched_events%rowtype; setting_row public.attendance_integration_settings%rowtype; mapped_employee uuid; existing_external text; result_log_id uuid; result_status text;
begin
  select * into event_row from public.attendance_unmatched_events where id = target_unmatched_event_id for update;
  if not found or event_row.resolved_at is not null then raise exception 'Unmatched attendance event was not found.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.employees where id = target_employee_id) then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  select employee_id into mapped_employee from public.attendance_identity_mappings where external_employee_id = event_row.external_employee_id for update;
  if found and mapped_employee <> target_employee_id then raise exception 'External employee ID is already mapped.' using errcode = '23505'; end if;
  select external_employee_id into existing_external from public.attendance_identity_mappings where employee_id = target_employee_id for update;
  if found and existing_external <> event_row.external_employee_id then raise exception 'Employee already has a different external ID mapping.' using errcode = '23505'; end if;
  insert into public.attendance_identity_mappings (employee_id, external_employee_id, created_by_user_id) values (target_employee_id, event_row.external_employee_id, caller_id) on conflict (external_employee_id) do nothing;
  select * into setting_row from public.attendance_integration_settings where id = event_row.integration_id for share;
  if event_row.event_type = 'attendance' and not private.attendance_time_in_is_accepted(event_row.time_in, setting_row.access_window_start, setting_row.timezone) then raise exception 'Attendance time-in is before the 05:00 access window.' using errcode = '22007'; end if;
  result_status := case when event_row.event_type = 'absence' then 'absent' when event_row.time_out is null then 'incomplete' when private.attendance_time_in_is_late(event_row.time_in, setting_row.workday_start, setting_row.late_grace_minutes, setting_row.timezone) then 'late' else 'present' end;
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, sync_metadata)
  values (target_employee_id, event_row.integration_id, event_row.source_event_id, event_row.external_employee_id, event_row.attendance_date, event_row.time_in, event_row.time_out, result_status, event_row.import_id, event_row.sync_metadata) returning id into result_log_id;
  update public.attendance_unmatched_events set resolved_by_user_id = caller_id, resolved_at = now(), resolved_log_id = result_log_id where id = event_row.id;
  update public.attendance_imports set accepted_count = accepted_count + 1 where id = event_row.import_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_unmatched_events', event_row.id::text, 'resolved', jsonb_build_object('employee_id', target_employee_id, 'log_id', result_log_id));
  return result_log_id;
end;
$$;

revoke all on function private.attendance_time_in_is_accepted(timestamptz, time, text) from public, anon, authenticated;
