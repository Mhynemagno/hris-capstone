-- Face-recognition attendance (capstone demonstration).
--
-- Policy change: this migration intentionally overrides the earlier rule that the HRIS never
-- stores biometric data. It stores one 128-value face descriptor per consenting employee; it
-- never stores face images or probe descriptors from scans. See
-- docs/superpowers/specs/2026-09-25-face-recognition-attendance-design.md.
--
-- Access model:
--   * HR kiosk (record_face_attendance): an HR session identifies the face among all enrollments.
--   * Employee self-scan (record_my_face_attendance): an employee signs in with their own account
--     and the face is verified against only their own enrollment.
--
-- Isolation model:
--   * Descriptors live in the non-exposed `private` schema. No role other than the table owner
--     can read or write them; PostgREST cannot reach them.
--   * Matching happens inside the database (record_face_attendance), so descriptors never
--     leave Postgres. The browser only ever sends a probe descriptor and receives a result.
--   * Enrollment, listing, deletion, and the kiosk require an active HR Personnel account (the
--     attendance import's gate). Self-scan requires an active employee account linked to a
--     personnel record. Every enrollment, deletion, and scan is audited.
--   * Attendance is written into the canonical public.attendance_logs table through the same
--     status rules as the CSV/XLSX import, with capture_method = 'face_recognition'.

-- ---------------------------------------------------------------------------
-- Canonical attendance log: allow a face-recognition source
-- ---------------------------------------------------------------------------

alter table public.attendance_integration_settings drop constraint attendance_integration_settings_adapter_key_check;
alter table public.attendance_integration_settings add constraint attendance_integration_settings_adapter_key_check check (adapter_key in ('csv_xlsx', 'face_recognition'));
insert into public.attendance_integration_settings (adapter_key) values ('face_recognition') on conflict (adapter_key) do nothing;

alter table public.attendance_logs
  add column capture_method text not null default 'import' check (capture_method in ('import', 'face_recognition')),
  alter column import_id drop not null,
  add constraint attendance_logs_capture_source_check check (
    (capture_method = 'import' and import_id is not null)
    or (capture_method = 'face_recognition' and import_id is null)
  );

-- One face-recognition log per employee per day; this is the final guard against duplicates.
create unique index attendance_logs_face_employee_day_key
  on public.attendance_logs (employee_id, attendance_date)
  where capture_method = 'face_recognition';

-- ---------------------------------------------------------------------------
-- Biometric storage (private schema, no client grants)
-- ---------------------------------------------------------------------------

create or replace function private.is_valid_face_descriptor(descriptor real[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select descriptor is not null
    and array_ndims(descriptor) = 1
    and cardinality(descriptor) = 128
    and not exists (
      select 1 from unnest(descriptor) as value
      where value is null or value = 'NaN'::real or value = 'Infinity'::real or value = '-Infinity'::real or abs(value) > 2
    );
$$;

create or replace function private.face_descriptor_distance(left_descriptor real[], right_descriptor real[])
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select sqrt(sum(((left_value)::double precision - (right_value)::double precision) ^ 2))
  from unnest(left_descriptor, right_descriptor) as pair(left_value, right_value);
$$;

create table private.face_recognition_settings (
  id boolean primary key default true check (id),
  is_enabled boolean not null default true,
  -- Euclidean distance at or below which a probe matches an enrollment. face-api.js suggests
  -- 0.6; 0.5 is stricter to reduce false accepts.
  match_threshold double precision not null default 0.5 check (match_threshold between 0.2 and 0.8),
  -- The runner-up must be at least this much farther than the best match, otherwise the scan
  -- is ambiguous and rejected.
  ambiguity_margin double precision not null default 0.04 check (ambiguity_margin between 0 and 0.3),
  -- A second scan sooner than this after time-in is treated as a repeat, not a time-out.
  min_time_out_minutes integer not null default 2 check (min_time_out_minutes between 0 and 720),
  -- Returning match distances lets a caller hill-climb a synthetic descriptor, so they are only
  -- returned when this is switched on for local threshold tuning.
  return_match_distance boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.face_recognition_settings (id) values (true);

create table private.employee_face_enrollments (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  descriptor real[] not null check (private.is_valid_face_descriptor(descriptor)),
  descriptor_model text not null default 'face-api/face_recognition_model@1' check (descriptor_model = btrim(descriptor_model) and char_length(descriptor_model) between 1 and 80),
  sample_count smallint not null check (sample_count between 3 and 10),
  consent_confirmed_at timestamptz not null,
  enrolled_by_user_id uuid references public.profiles (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotency and audit ledger for kiosk scans. It never stores a descriptor.
create table private.face_attendance_scans (
  id uuid primary key,
  outcome text not null check (outcome in ('time_in', 'time_out', 'already_recorded', 'rejected', 'not_recognized')),
  employee_id uuid references public.employees (id) on delete cascade,
  attendance_log_id uuid references public.attendance_logs (id) on delete set null,
  match_distance double precision check (match_distance is null or match_distance >= 0),
  message text check (message is null or char_length(message) <= 200),
  recorded_by_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((outcome = 'not_recognized') = (employee_id is null))
);

create index face_attendance_scans_employee_idx on private.face_attendance_scans (employee_id, created_at desc) where employee_id is not null;
create index face_attendance_scans_log_idx on private.face_attendance_scans (attendance_log_id) where attendance_log_id is not null;
create index employee_face_enrollments_enrolled_by_idx on private.employee_face_enrollments (enrolled_by_user_id);
create index face_attendance_scans_recorded_by_idx on private.face_attendance_scans (recorded_by_user_id);

alter table private.face_recognition_settings enable row level security;
alter table private.employee_face_enrollments enable row level security;
alter table private.face_attendance_scans enable row level security;
-- No policies: with RLS on and no grants, only security-definer functions owned by the
-- migration role can touch these tables.
revoke all on private.face_recognition_settings, private.employee_face_enrollments, private.face_attendance_scans from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enrollment
-- ---------------------------------------------------------------------------

create or replace function private.list_face_enrollments()
returns table (employee_id uuid, sample_count smallint, enrolled_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_active_hr();
  return query
    select enrollment.employee_id, enrollment.sample_count, enrollment.enrolled_at, enrollment.updated_at
    from private.employee_face_enrollments enrollment
    order by enrollment.updated_at desc;
end;
$$;

create or replace function private.enroll_employee_face(target_employee_id uuid, target_descriptor real[], target_sample_count integer, target_consent_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  settings_row private.face_recognition_settings%rowtype;
  conflicting_employee uuid;
  was_enrolled boolean;
  account_active boolean;
begin
  if target_consent_confirmed is not true then
    raise exception 'Confirm the employee consented to face registration.' using errcode = '22023';
  end if;
  if not private.is_valid_face_descriptor(target_descriptor) or target_sample_count is null or target_sample_count not between 3 and 10 then
    raise exception 'The face sample is invalid. Capture the face again.' using errcode = '22023';
  end if;
  select * into settings_row from private.face_recognition_settings where id;

  perform 1 from public.employees where id = target_employee_id for share;
  if not found then
    raise exception 'Employee was not found.' using errcode = 'P0001';
  end if;
  -- Retention is tied to the linked account, so an employee needs an active login to register.
  -- The share lock makes a concurrent deactivation wait until this enrollment is visible to its purge trigger.
  select profile.is_active into account_active
  from public.employees employee
  join public.profiles profile on profile.id = employee.profile_id
  where employee.id = target_employee_id
  for share of profile;
  if account_active is not true then
    raise exception 'Only employees with an active linked account can be registered for face attendance.' using errcode = 'P0001';
  end if;

  -- Serialize enrollments so two concurrent registrations cannot both pass the similarity check.
  perform pg_advisory_xact_lock(hashtext('face_enrollment'));

  -- A face that already matches a different employee would make recognition ambiguous.
  select enrollment.employee_id into conflicting_employee
  from private.employee_face_enrollments enrollment
  where enrollment.employee_id <> target_employee_id
    and private.face_descriptor_distance(enrollment.descriptor, target_descriptor) <= settings_row.match_threshold
  limit 1;
  if found then
    raise exception 'This face is too similar to another registered employee.' using errcode = '23505';
  end if;

  select exists (select 1 from private.employee_face_enrollments where employee_id = target_employee_id) into was_enrolled;

  -- Re-registration replaces the old descriptor only inside this successful transaction.
  insert into private.employee_face_enrollments (employee_id, descriptor, sample_count, consent_confirmed_at, enrolled_by_user_id)
  values (target_employee_id, target_descriptor, target_sample_count, now(), caller_id)
  on conflict (employee_id) do update
    set descriptor = excluded.descriptor,
        sample_count = excluded.sample_count,
        consent_confirmed_at = excluded.consent_confirmed_at,
        enrolled_by_user_id = excluded.enrolled_by_user_id,
        updated_at = now();

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'employee_face_enrollments', target_employee_id::text, case when was_enrolled then 're_registered' else 'enrolled' end, jsonb_build_object('sample_count', target_sample_count));

  return jsonb_build_object('employeeId', target_employee_id, 'status', case when was_enrolled then 're_registered' else 'enrolled' end);
end;
$$;

create or replace function private.delete_employee_face_enrollment(target_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := private.require_active_hr();
begin
  delete from private.employee_face_enrollments where employee_id = target_employee_id;
  if not found then
    raise exception 'This employee has no face registration.' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'employee_face_enrollments', target_employee_id::text, 'deleted', jsonb_build_object('reason', 'hr_request'));
end;
$$;

-- Retention: a descriptor is kept only while the employee's linked account is active (enrollment
-- requires one). Deactivating the account (offboarding) deletes it, deleting the employee record
-- cascades, and HR can delete it at any time on request.
create or replace function private.purge_face_enrollment_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare purged_employee uuid;
begin
  if old.is_active and not new.is_active then
    for purged_employee in
      delete from private.employee_face_enrollments enrollment
      using public.employees employee
      where employee.id = enrollment.employee_id and employee.profile_id = new.id
      returning enrollment.employee_id
    loop
      insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
      values ((select auth.uid()), 'employee_face_enrollments', purged_employee::text, 'deleted', jsonb_build_object('reason', 'account_deactivated'));
    end loop;
  end if;
  return new;
end;
$$;

create trigger profiles_purge_face_enrollment
after update of is_active on public.profiles
for each row execute function private.purge_face_enrollment_on_deactivation();

-- ---------------------------------------------------------------------------
-- Recognition and attendance write
-- ---------------------------------------------------------------------------

create or replace function private.face_scan_result(scan_row private.face_attendance_scans)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'scanId', scan_row.id,
    'outcome', scan_row.outcome,
    'message', scan_row.message,
    'distance', case when (select settings.return_match_distance from private.face_recognition_settings settings where settings.id) then scan_row.match_distance end,
    'employee', case when employee.id is null then null else jsonb_build_object('id', employee.id, 'employeeNumber', employee.employee_number, 'firstName', employee.first_name, 'lastName', employee.last_name) end,
    'log', case when log.id is null then null else jsonb_build_object('id', log.id, 'attendanceDate', log.attendance_date, 'timeIn', log.time_in, 'timeOut', log.time_out, 'status', log.status) end,
    'recordedAt', scan_row.created_at
  )
  from (select 1) as anchor
  left join public.employees employee on employee.id = scan_row.employee_id
  left join public.attendance_logs log on log.id = scan_row.attendance_log_id;
$$;

-- Idempotency: waits for any concurrent attempt with this scan ID and returns its stored result,
-- or null when the scan ID is new. A scan ID can only be replayed by the account that created it.
create or replace function private.previous_face_scan(target_scan_id uuid, caller_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare scan_row private.face_attendance_scans%rowtype;
begin
  if target_scan_id is null then
    raise exception 'A scan ID is required.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('face_scan:' || target_scan_id::text));
  select * into scan_row from private.face_attendance_scans where id = target_scan_id;
  if not found then
    return null;
  end if;
  if scan_row.recorded_by_user_id is distinct from caller_id then
    raise exception 'This scan belongs to another session.' using errcode = '42501';
  end if;
  return private.face_scan_result(scan_row);
end;
$$;

create or replace function private.require_face_attendance_enabled()
returns private.face_recognition_settings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare settings_row private.face_recognition_settings%rowtype;
begin
  select * into settings_row from private.face_recognition_settings where id;
  if not found or not settings_row.is_enabled then
    raise exception 'Face attendance is unavailable.' using errcode = 'P0001';
  end if;
  return settings_row;
end;
$$;

-- Records a scan that matched no one (or not the signed-in employee). Writes no attendance.
create or replace function private.reject_face_scan(target_scan_id uuid, target_distance double precision, caller_id uuid, target_metadata jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare scan_row private.face_attendance_scans%rowtype;
begin
  insert into private.face_attendance_scans (id, outcome, match_distance, message, recorded_by_user_id)
  values (target_scan_id, 'not_recognized', target_distance, 'Face not recognized.', caller_id)
  returning * into scan_row;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'face_attendance_scans', target_scan_id::text, 'not_recognized', target_metadata);
  return private.face_scan_result(scan_row);
end;
$$;

-- Applies the attendance rules for an identified employee. Shared by the HR kiosk and self-scan.
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

  if exists (select 1 from public.attendance_logs where employee_id = target_employee_id and attendance_date = scan_date and capture_method = 'import') then
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

-- HR kiosk: identify (1:N) among every enrollment.
create or replace function private.record_face_attendance(target_scan_id uuid, target_descriptor real[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  previous jsonb := private.previous_face_scan(target_scan_id, caller_id);
  settings_row private.face_recognition_settings%rowtype;
  best_employee uuid;
  best_distance double precision;
  runner_up_distance double precision;
begin
  if previous is not null then
    return previous;
  end if;
  if not private.is_valid_face_descriptor(target_descriptor) then
    raise exception 'The face sample is invalid. Scan again.' using errcode = '22023';
  end if;
  settings_row := private.require_face_attendance_enabled();

  select ranked.employee_id, ranked.distance into best_employee, best_distance
  from (
    select enrollment.employee_id, private.face_descriptor_distance(enrollment.descriptor, target_descriptor) as distance
    from private.employee_face_enrollments enrollment
  ) ranked
  order by ranked.distance
  limit 1;

  select ranked.distance into runner_up_distance
  from (
    select private.face_descriptor_distance(enrollment.descriptor, target_descriptor) as distance
    from private.employee_face_enrollments enrollment
    where enrollment.employee_id <> best_employee
  ) ranked
  order by ranked.distance
  limit 1;

  if best_employee is null
     or best_distance > settings_row.match_threshold
     or (runner_up_distance is not null and runner_up_distance - best_distance < settings_row.ambiguity_margin) then
    return private.reject_face_scan(target_scan_id, best_distance, caller_id, jsonb_build_object('mode', 'kiosk'));
  end if;

  return private.write_face_attendance(target_scan_id, best_employee, best_distance, caller_id, 'kiosk');
end;
$$;

-- The signed-in employee's own employee record, or an authorization error.
create or replace function private.require_active_employee_self()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  own_employee uuid;
begin
  select employee.id into own_employee
  from public.employees employee
  join public.profiles profile on profile.id = employee.profile_id
  join public.user_roles user_role on user_role.user_id = profile.id
  where profile.id = caller_id and profile.is_active and user_role.role = 'employee'::public.app_role;
  if caller_id is null or own_employee is null then
    raise exception 'An active employee account linked to a personnel record is required.' using errcode = '42501';
  end if;
  return own_employee;
end;
$$;

create or replace function private.get_my_face_registration()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  own_employee uuid := private.require_active_employee_self();
  registered_at timestamptz;
begin
  select enrollment.updated_at into registered_at from private.employee_face_enrollments enrollment where enrollment.employee_id = own_employee;
  return jsonb_build_object('registered', registered_at is not null, 'updatedAt', registered_at);
end;
$$;

-- Employee self-scan: verify (1:1) against only the signed-in employee's own enrollment, so an
-- employee session can never probe anyone else's face template.
create or replace function private.record_my_face_attendance(target_scan_id uuid, target_descriptor real[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  own_employee uuid := private.require_active_employee_self();
  caller_id uuid := (select auth.uid());
  previous jsonb := private.previous_face_scan(target_scan_id, caller_id);
  settings_row private.face_recognition_settings%rowtype;
  own_distance double precision;
begin
  if previous is not null then
    return previous;
  end if;
  if not private.is_valid_face_descriptor(target_descriptor) then
    raise exception 'The face sample is invalid. Scan again.' using errcode = '22023';
  end if;
  settings_row := private.require_face_attendance_enabled();

  select private.face_descriptor_distance(enrollment.descriptor, target_descriptor) into own_distance
  from private.employee_face_enrollments enrollment
  where enrollment.employee_id = own_employee;
  if not found then
    raise exception 'Your face is not registered yet. Ask HR to register it.' using errcode = 'P0001';
  end if;

  if own_distance > settings_row.match_threshold then
    return private.reject_face_scan(target_scan_id, own_distance, caller_id, jsonb_build_object('mode', 'self', 'employee_id', own_employee));
  end if;

  return private.write_face_attendance(target_scan_id, own_employee, own_distance, caller_id, 'self');
end;
$$;

-- ---------------------------------------------------------------------------
-- Imports: never double-count a day already recorded by a face scan
-- ---------------------------------------------------------------------------

-- Redefined from 20260823205508_attendance_integration.sql; only the face-log check is new.
create or replace function private.process_attendance_event(target_import_id uuid, target_external_employee_id text, target_source_event_id text, target_attendance_date date, target_time_in timestamptz, target_time_out timestamptz, target_event_type text, target_metadata jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); setting_row public.attendance_integration_settings%rowtype; mapping_row public.attendance_identity_mappings%rowtype; result_status text; clean_external text := upper(btrim(target_external_employee_id)); clean_event text := btrim(target_source_event_id);
begin
  select * into setting_row from public.attendance_integration_settings where adapter_key = 'csv_xlsx' for share;
  if not found or not setting_row.is_enabled then raise exception 'Attendance import is unavailable.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.attendance_imports where id = target_import_id) then raise exception 'Attendance import was not found.' using errcode = 'P0001'; end if;
  if clean_external is null or char_length(clean_external) not between 1 and 64 or clean_event is null or char_length(clean_event) not between 1 and 128 or target_event_type not in ('attendance', 'absence') or jsonb_typeof(target_metadata) <> 'object' or exists (select 1 from jsonb_object_keys(target_metadata) key where key not in ('adapterVersion', 'templateVersion', 'rowNumber', 'checksum')) then raise exception 'Attendance event is invalid.' using errcode = '22023'; end if;
  if (target_event_type = 'absence' and (target_time_in is not null or target_time_out is not null)) or (target_event_type = 'attendance' and target_time_in is null) or (target_time_out is not null and target_time_out < target_time_in) then raise exception 'Attendance event times are invalid.' using errcode = '22007'; end if;
  if exists (select 1 from public.attendance_logs where integration_id = setting_row.id and source_event_id = clean_event) or exists (select 1 from public.attendance_unmatched_events where integration_id = setting_row.id and source_event_id = clean_event) then return 'duplicate'; end if;
  select * into mapping_row from public.attendance_identity_mappings where external_employee_id = clean_external for share;
  if not found then
    insert into public.attendance_unmatched_events (integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, event_type, import_id, sync_metadata)
    values (setting_row.id, clean_event, clean_external, target_attendance_date, target_time_in, target_time_out, target_event_type, target_import_id, target_metadata);
    update public.attendance_imports set unmatched_count = unmatched_count + 1 where id = target_import_id;
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_unmatched_events', clean_event, 'queued', jsonb_build_object('external_employee_id', clean_external));
    return 'unmatched';
  end if;
  -- Same lock as record_face_attendance; a day already recorded by a face scan is a duplicate.
  perform pg_advisory_xact_lock(hashtext('face_attendance:' || mapping_row.employee_id::text || ':' || target_attendance_date::text));
  if exists (select 1 from public.attendance_logs where employee_id = mapping_row.employee_id and attendance_date = target_attendance_date and capture_method = 'face_recognition') then return 'duplicate'; end if;
  result_status := case when target_event_type = 'absence' then 'absent' when target_time_out is null then 'incomplete' when (target_time_in at time zone setting_row.timezone)::time > setting_row.workday_start + make_interval(mins => setting_row.late_grace_minutes) then 'late' else 'present' end;
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, sync_metadata)
  values (mapping_row.employee_id, setting_row.id, clean_event, clean_external, target_attendance_date, target_time_in, target_time_out, result_status, target_import_id, target_metadata);
  update public.attendance_imports set accepted_count = accepted_count + 1 where id = target_import_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_logs', clean_event, 'imported', jsonb_build_object('employee_id', mapping_row.employee_id, 'status', result_status));
  return 'inserted';
end;
$$;

create or replace function private.resolve_attendance_unmatched_event(target_unmatched_event_id uuid, target_employee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); event_row public.attendance_unmatched_events%rowtype; setting_row public.attendance_integration_settings%rowtype; mapped_employee uuid; existing_external text; result_log_id uuid; result_status text;
begin
  select * into event_row from public.attendance_unmatched_events where id = target_unmatched_event_id for update;
  if not found or event_row.resolved_at is not null then raise exception 'Unmatched attendance event was not found.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.employees where id = target_employee_id) then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('face_attendance:' || target_employee_id::text || ':' || event_row.attendance_date::text));
  if exists (select 1 from public.attendance_logs where employee_id = target_employee_id and attendance_date = event_row.attendance_date and capture_method = 'face_recognition') then raise exception 'This employee already has a face-scan attendance record for that date.' using errcode = '23505'; end if;
  select employee_id into mapped_employee from public.attendance_identity_mappings where external_employee_id = event_row.external_employee_id for update;
  if found and mapped_employee <> target_employee_id then raise exception 'External employee ID is already mapped.' using errcode = '23505'; end if;
  select external_employee_id into existing_external from public.attendance_identity_mappings where employee_id = target_employee_id for update;
  if found and existing_external <> event_row.external_employee_id then raise exception 'Employee already has a different external ID mapping.' using errcode = '23505'; end if;
  insert into public.attendance_identity_mappings (employee_id, external_employee_id, created_by_user_id) values (target_employee_id, event_row.external_employee_id, caller_id) on conflict (external_employee_id) do nothing;
  select * into setting_row from public.attendance_integration_settings where id = event_row.integration_id for share;
  result_status := case when event_row.event_type = 'absence' then 'absent' when event_row.time_out is null then 'incomplete' when (event_row.time_in at time zone setting_row.timezone)::time > setting_row.workday_start + make_interval(mins => setting_row.late_grace_minutes) then 'late' else 'present' end;
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, sync_metadata)
  values (target_employee_id, event_row.integration_id, event_row.source_event_id, event_row.external_employee_id, event_row.attendance_date, event_row.time_in, event_row.time_out, result_status, event_row.import_id, event_row.sync_metadata) returning id into result_log_id;
  update public.attendance_unmatched_events set resolved_by_user_id = caller_id, resolved_at = now(), resolved_log_id = result_log_id where id = event_row.id;
  update public.attendance_imports set accepted_count = accepted_count + 1 where id = event_row.import_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_unmatched_events', event_row.id::text, 'resolved', jsonb_build_object('employee_id', target_employee_id, 'log_id', result_log_id));
  return result_log_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPC wrappers (the only entry points exposed to the API)
-- ---------------------------------------------------------------------------

create or replace function public.list_face_enrollments()
returns table (employee_id uuid, sample_count smallint, enrolled_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$ begin return query select * from private.list_face_enrollments(); end; $$;

create or replace function public.enroll_employee_face(target_employee_id uuid, target_descriptor real[], target_sample_count integer, target_consent_confirmed boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$ begin return private.enroll_employee_face(target_employee_id, target_descriptor, target_sample_count, target_consent_confirmed); end; $$;

create or replace function public.delete_employee_face_enrollment(target_employee_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$ begin perform private.delete_employee_face_enrollment(target_employee_id); end; $$;

create or replace function public.record_face_attendance(target_scan_id uuid, target_descriptor real[])
returns jsonb language plpgsql security definer set search_path = ''
as $$ begin return private.record_face_attendance(target_scan_id, target_descriptor); end; $$;

create or replace function public.record_my_face_attendance(target_scan_id uuid, target_descriptor real[])
returns jsonb language plpgsql security definer set search_path = ''
as $$ begin return private.record_my_face_attendance(target_scan_id, target_descriptor); end; $$;

create or replace function public.get_my_face_registration()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ begin return private.get_my_face_registration(); end; $$;

revoke all on function
  private.is_valid_face_descriptor(real[]),
  private.face_descriptor_distance(real[], real[]),
  private.list_face_enrollments(),
  private.enroll_employee_face(uuid, real[], integer, boolean),
  private.delete_employee_face_enrollment(uuid),
  private.purge_face_enrollment_on_deactivation(),
  private.face_scan_result(private.face_attendance_scans),
  private.previous_face_scan(uuid, uuid),
  private.require_face_attendance_enabled(),
  private.reject_face_scan(uuid, double precision, uuid, jsonb),
  private.write_face_attendance(uuid, uuid, double precision, uuid, text),
  private.record_face_attendance(uuid, real[]),
  private.require_active_employee_self(),
  private.get_my_face_registration(),
  private.record_my_face_attendance(uuid, real[])
from public, anon, authenticated;

revoke all on function
  public.list_face_enrollments(),
  public.enroll_employee_face(uuid, real[], integer, boolean),
  public.delete_employee_face_enrollment(uuid),
  public.record_face_attendance(uuid, real[]),
  public.record_my_face_attendance(uuid, real[]),
  public.get_my_face_registration()
from public, anon;

grant execute on function
  public.list_face_enrollments(),
  public.enroll_employee_face(uuid, real[], integer, boolean),
  public.delete_employee_face_enrollment(uuid),
  public.record_face_attendance(uuid, real[]),
  public.record_my_face_attendance(uuid, real[]),
  public.get_my_face_registration()
to authenticated;
