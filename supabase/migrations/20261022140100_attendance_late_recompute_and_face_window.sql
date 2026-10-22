-- Final Revisions PDF p. 16 (audit fixes, 2026-10-22). Duty starts 08:00 and scans are accepted from 05:00;
-- 07:38 is not late. The rule is right for new rows (20261021190000_final_pdf_attendance_window.sql), but:
--   * rows stored while the scheduled start was 05:00 (20261015023028_final_pdf_attendance_dashboard.sql)
--     kept their 'late' status. Every complete row is recomputed with the current rule: only 'late' and
--     'present' rows change (between each other); absent and open ('incomplete') rows keep their status.
--   * face scans ignored the 05:00 access window that imports enforce. They are now refused with a message.
--   * an open log (time-in, no time-out) counts as Late on the HR dashboard when its time-in is late, but
--     lists showed it as Partial. attendance_logs.time_in_late stores the same workday start + grace test,
--     kept by a trigger, so lists show such a log as Late and the Late filter matches the dashboard. The
--     stored status stays 'incomplete', which the dashboard's open-log count and the time-out flow rely on.
-- The rule uses the organization schedule (the csv_xlsx settings row), as imports and face scans do.

alter table public.attendance_logs
  add column time_in_late boolean not null default false;

comment on column public.attendance_logs.time_in_late is
  'True when time_in is after the workday start plus the late grace (organization schedule). Kept by trigger.';

create function private.set_attendance_log_time_in_late()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_row public.attendance_integration_settings%rowtype;
begin
  select * into schedule_row from public.attendance_integration_settings where adapter_key = 'csv_xlsx';
  new.time_in_late := coalesce(
    new.time_in is not null
      and schedule_row.id is not null
      and private.attendance_time_in_is_late(new.time_in, schedule_row.workday_start, schedule_row.late_grace_minutes, schedule_row.timezone),
    false
  );
  return new;
end;
$$;

revoke all on function private.set_attendance_log_time_in_late() from public, anon, authenticated;

create trigger attendance_logs_set_time_in_late
  before insert or update of time_in, time_in_late on public.attendance_logs
  for each row execute function private.set_attendance_log_time_in_late();

-- Recomputes every stored row with the current rule and returns how many statuses changed. Kept as a
-- function so the rule can be re-applied (and tested) after a schedule change.
create function private.recompute_attendance_late_statuses()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_row public.attendance_integration_settings%rowtype;
  to_present integer;
  to_late integer;
begin
  select * into schedule_row from public.attendance_integration_settings where adapter_key = 'csv_xlsx';
  if schedule_row.id is null then
    return jsonb_build_object('late_to_present', 0, 'present_to_late', 0);
  end if;

  select
    count(*) filter (where log.status = 'late' and not private.attendance_time_in_is_late(log.time_in, schedule_row.workday_start, schedule_row.late_grace_minutes, schedule_row.timezone)),
    count(*) filter (where log.status = 'present' and private.attendance_time_in_is_late(log.time_in, schedule_row.workday_start, schedule_row.late_grace_minutes, schedule_row.timezone))
  into to_present, to_late
  from public.attendance_logs log
  where log.time_in is not null;

  -- Writing time_in_late fires the trigger, which assigns the recomputed value.
  update public.attendance_logs log
  set time_in_late = true,
      status = case
        when log.status in ('late', 'present') and log.time_in is not null then
          case when private.attendance_time_in_is_late(log.time_in, schedule_row.workday_start, schedule_row.late_grace_minutes, schedule_row.timezone) then 'late' else 'present' end
        else log.status
      end;

  return jsonb_build_object('late_to_present', to_present, 'present_to_late', to_late);
end;
$$;

revoke all on function private.recompute_attendance_late_statuses() from public, anon, authenticated;

do $$
declare
  changes jsonb := private.recompute_attendance_late_statuses();
begin
  if (changes ->> 'late_to_present')::integer + (changes ->> 'present_to_late')::integer > 0 then
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
    values (null, 'attendance_logs', 'all', 'status_recomputed', changes || jsonb_build_object('reason', 'Duty starts at 08:00 and scans are accepted from 05:00; late is counted from the workday start plus grace.'));
  end if;
end;
$$;

-- Same body as 20260925090000_face_recognition_attendance.sql (its latest definition) plus the access-window check.
create or replace function private.write_face_attendance(target_scan_id uuid, target_employee_id uuid, target_distance double precision, caller_id uuid, target_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings_row private.face_recognition_settings%rowtype := private.require_face_attendance_enabled();
  schedule_row public.attendance_integration_settings%rowtype;
  face_integration_id uuid;
  scan_row private.face_attendance_scans%rowtype;
  employee_row public.employees%rowtype;
  log_row public.attendance_logs%rowtype;
  scan_time timestamptz := now();
  scan_date date;
  result_outcome text;
  result_message text;
  result_log_id uuid;
begin
  select id into face_integration_id from public.attendance_integration_settings where adapter_key = 'face_recognition';
  -- Face scans follow the organization schedule configured for the attendance integration.
  select * into schedule_row from public.attendance_integration_settings where adapter_key = 'csv_xlsx';
  if face_integration_id is null or schedule_row.id is null then
    raise exception 'Face attendance is unavailable.' using errcode = 'P0001';
  end if;

  select * into employee_row from public.employees where id = target_employee_id;
  scan_date := (scan_time at time zone schedule_row.timezone)::date;

  -- Serialize scans of one employee on one day across kiosks, devices, and retries.
  perform pg_advisory_xact_lock(hashtext('face_attendance:' || target_employee_id::text || ':' || scan_date::text));

  -- The same access window as imports: a scan before access_window_start (05:00) records nothing.
  if not private.attendance_time_in_is_accepted(scan_time, schedule_row.access_window_start, schedule_row.timezone) then
    result_outcome := 'rejected';
    result_message := 'Attendance opens at ' || to_char(schedule_row.access_window_start, 'HH24:MI') || '. Scan again from ' || to_char(schedule_row.access_window_start, 'HH24:MI') || ' onwards.';
  elsif exists (select 1 from public.attendance_logs where employee_id = target_employee_id and attendance_date = scan_date and capture_method = 'import') then
    result_outcome := 'rejected';
    result_message := 'Attendance for today was already imported for this employee.';
  else
    select * into log_row from public.attendance_logs
    where employee_id = target_employee_id and attendance_date = scan_date and capture_method = 'face_recognition'
    for update;

    if not found then
      insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, capture_method, sync_metadata)
      values (target_employee_id, face_integration_id, 'face:' || target_employee_id::text || ':' || scan_date::text, employee_row.employee_number, scan_date, scan_time, null, 'incomplete', null, 'face_recognition', jsonb_build_object('scanId', target_scan_id, 'mode', target_mode))
      returning id into result_log_id;
      result_outcome := 'time_in';
    elsif log_row.time_out is not null then
      result_outcome := 'already_recorded';
      result_message := 'Time in and time out are already recorded for today.';
      result_log_id := log_row.id;
    elsif scan_time < log_row.time_in + make_interval(mins => settings_row.min_time_out_minutes) then
      result_outcome := 'already_recorded';
      result_message := 'Time in is already recorded. Scan again later to record time out.';
      result_log_id := log_row.id;
    else
      update public.attendance_logs
      set time_out = scan_time,
          status = case when (log_row.time_in at time zone schedule_row.timezone)::time > schedule_row.workday_start + make_interval(mins => schedule_row.late_grace_minutes) then 'late' else 'present' end,
          sync_metadata = sync_metadata || jsonb_build_object('timeOutScanId', target_scan_id, 'timeOutMode', target_mode)
      where id = log_row.id;
      result_log_id := log_row.id;
      result_outcome := 'time_out';
    end if;
  end if;

  insert into private.face_attendance_scans (id, outcome, employee_id, attendance_log_id, match_distance, message, recorded_by_user_id, created_at)
  values (target_scan_id, result_outcome, target_employee_id, result_log_id, target_distance, result_message, caller_id, scan_time)
  returning * into scan_row;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (
    caller_id,
    case when result_log_id is null then 'face_attendance_scans' else 'attendance_logs' end,
    coalesce(result_log_id::text, target_scan_id::text),
    'face_' || result_outcome,
    jsonb_build_object('employee_id', target_employee_id, 'scan_id', target_scan_id, 'mode', target_mode)
  );

  return private.face_scan_result(scan_row);
end;
$$;

revoke all on function private.write_face_attendance(uuid, uuid, double precision, uuid, text) from public, anon, authenticated;
