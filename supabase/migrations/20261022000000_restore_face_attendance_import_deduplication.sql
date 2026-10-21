-- Preserve the established rule that an import cannot create a second log for
-- an employee whose face scan has already recorded the same attendance day.
-- This is a forward-only repair for the function replaced by the final
-- attendance access-window migration.
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
  if exists (
    select 1 from public.attendance_logs
    where employee_id = mapping_row.employee_id
      and attendance_date = target_attendance_date
      and capture_method = 'face_recognition'
  ) then
    return 'duplicate';
  end if;
  result_status := case when target_event_type = 'absence' then 'absent' when target_time_out is null then 'incomplete' when private.attendance_time_in_is_late(target_time_in, setting_row.workday_start, setting_row.late_grace_minutes, setting_row.timezone) then 'late' else 'present' end;
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, sync_metadata)
  values (mapping_row.employee_id, setting_row.id, clean_event, clean_external, target_attendance_date, target_time_in, target_time_out, result_status, target_import_id, target_metadata);
  update public.attendance_imports set accepted_count = accepted_count + 1 where id = target_import_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_logs', clean_event, 'imported', jsonb_build_object('employee_id', mapping_row.employee_id, 'status', result_status));
  return 'inserted';
end;
$$;
