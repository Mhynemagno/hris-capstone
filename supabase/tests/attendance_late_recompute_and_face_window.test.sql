begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(16);

select extensions.has_column('public', 'attendance_logs', 'time_in_late', 'Attendance logs store whether the time-in is late');
select extensions.has_function('private', 'recompute_attendance_late_statuses', 'Stored statuses can be recomputed with the current rule');

-- The organization schedule: duty starts 08:00 with the configured grace; scans accepted from 05:00.
update public.attendance_integration_settings
set workday_start = time '08:00', late_grace_minutes = 15, access_window_start = time '05:00'
where adapter_key = 'csv_xlsx';

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000141001', 'LATE-001', 'Recompute', 'Officer', 'late-recompute@example.test', '2024-01-01');

create temporary table late_fixture (key text primary key, log_id uuid) on commit drop;

-- Face-captured rows (no import run). Times are local to the schedule timezone.
with schedule as (select timezone from public.attendance_integration_settings where adapter_key = 'csv_xlsx'),
face as (select id from public.attendance_integration_settings where adapter_key = 'face_recognition'),
rows (key, day, time_in, time_out, status) as (values
  ('stale_late_0738', date '2026-09-01', time '07:38', time '17:00', 'late'),
  ('present_0810', date '2026-09-02', time '08:10', time '17:00', 'present'),
  ('late_0950', date '2026-09-03', time '09:50', time '17:00', 'late'),
  ('open_late_0840', date '2026-09-04', time '08:40', null::time, 'incomplete'),
  ('open_early_0700', date '2026-09-05', time '07:00', null::time, 'incomplete'),
  ('absent', date '2026-09-06', null::time, null::time, 'absent')
),
inserted as (
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, capture_method)
  select '00000000-0000-4000-8000-000000141001', face.id, 'late-test:' || rows.key, 'LATE-001', rows.day,
    case when rows.time_in is null then null else (rows.day + rows.time_in) at time zone schedule.timezone end,
    case when rows.time_out is null then null else (rows.day + rows.time_out) at time zone schedule.timezone end,
    rows.status, null, 'face_recognition'
  from rows, schedule, face
  returning id, source_event_id
)
insert into late_fixture select replace(source_event_id, 'late-test:', ''), id from inserted;

select extensions.is(
  (select array_agg(log.time_in_late order by fixture.key) from public.attendance_logs log join late_fixture fixture on fixture.log_id = log.id),
  array[false, true, false, true, false, false],
  'time_in_late follows 08:00 plus grace: 07:00, 07:38 and 08:10 are on time; 08:40 and 09:50 are late; an absence is not late'
);

select extensions.is(
  private.recompute_attendance_late_statuses(),
  jsonb_build_object('late_to_present', 1, 'present_to_late', 0),
  'Recomputing flips only the stale late row'
);

select extensions.is((select status from public.attendance_logs where id = (select log_id from late_fixture where key = 'stale_late_0738')), 'present', 'A 07:38 time-in stored as late during the 05:00-start period becomes present');
select extensions.is((select status from public.attendance_logs where id = (select log_id from late_fixture where key = 'present_0810')), 'present', 'A time-in within the grace period stays present');
select extensions.is((select status from public.attendance_logs where id = (select log_id from late_fixture where key = 'late_0950')), 'late', 'A time-in after 08:00 plus grace stays late');
select extensions.is((select status from public.attendance_logs where id = (select log_id from late_fixture where key = 'open_late_0840')), 'incomplete', 'An open log keeps its incomplete status');
select extensions.is((select status from public.attendance_logs where id = (select log_id from late_fixture where key = 'absent')), 'absent', 'An absence is untouched');

update public.attendance_logs set time_in = time_in - interval '1 hour' where id = (select log_id from late_fixture where key = 'open_late_0840');
select extensions.ok(
  not (select time_in_late from public.attendance_logs where id = (select log_id from late_fixture where key = 'open_late_0840')),
  'Changing the time-in recomputes time_in_late'
);
update public.attendance_logs set time_in_late = true where id = (select log_id from late_fixture where key = 'open_early_0700');
select extensions.ok(
  not (select time_in_late from public.attendance_logs where id = (select log_id from late_fixture where key = 'open_early_0700')),
  'time_in_late cannot be written directly'
);

-- ---------------------------------------------------------------------------
-- Face scans honour the 05:00 access window, like imports
-- ---------------------------------------------------------------------------

-- Move the window just past the current local time, so this scan is "too early".
update public.attendance_integration_settings setting
set access_window_start = least((now() at time zone setting.timezone)::time + interval '1 minute', time '23:59:59')
where adapter_key = 'csv_xlsx';

create temporary table scan_result (key text primary key, result jsonb) on commit drop;
insert into scan_result values ('early', private.write_face_attendance(gen_random_uuid(), '00000000-0000-4000-8000-000000141001', 0.1, null, 'kiosk'));

select extensions.is((select result ->> 'outcome' from scan_result where key = 'early'), 'rejected', 'A face scan before the access window is rejected');
select extensions.matches((select result ->> 'message' from scan_result where key = 'early'), '^Attendance opens at [0-9]{2}:[0-9]{2}\. Scan again from [0-9]{2}:[0-9]{2} onwards\.$', 'The rejection explains when attendance opens');
select extensions.is(
  (select count(*) from public.attendance_logs where employee_id = '00000000-0000-4000-8000-000000141001' and attendance_date = (now() at time zone (select timezone from public.attendance_integration_settings where adapter_key = 'csv_xlsx'))::date),
  0::bigint,
  'A rejected early scan records no attendance'
);
select extensions.is(
  (select count(*) from private.face_attendance_scans where id = ((select result ->> 'scanId' from scan_result where key = 'early'))::uuid and outcome = 'rejected'),
  1::bigint,
  'The rejected scan is kept in the scan log'
);

update public.attendance_integration_settings set access_window_start = time '00:00' where adapter_key = 'csv_xlsx';
insert into scan_result values ('open', private.write_face_attendance(gen_random_uuid(), '00000000-0000-4000-8000-000000141001', 0.1, null, 'kiosk'));
select extensions.is((select result ->> 'outcome' from scan_result where key = 'open'), 'time_in', 'A face scan inside the access window records the time-in');

select * from extensions.finish();
rollback;
