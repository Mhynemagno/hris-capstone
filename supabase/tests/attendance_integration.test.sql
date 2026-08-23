begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(15);

select extensions.has_table('public', 'attendance_integration_settings', 'Attendance settings table exists');
select extensions.has_table('public', 'attendance_identity_mappings', 'Attendance identity mappings table exists');
select extensions.has_table('public', 'attendance_imports', 'Attendance imports table exists');
select extensions.has_table('public', 'attendance_logs', 'Attendance logs table exists');
select extensions.has_table('public', 'attendance_unmatched_events', 'Attendance unmatched events table exists');
select extensions.has_function('public', 'create_attendance_import', array['text', 'text', 'text'], 'Attendance import RPC exists');
select extensions.has_function('public', 'process_attendance_event', array['uuid', 'text', 'text', 'date', 'timestamp with time zone', 'timestamp with time zone', 'text', 'jsonb'], 'Attendance event RPC exists');
select extensions.has_function('public', 'resolve_attendance_unmatched_event', array['uuid', 'uuid'], 'Attendance unmatched-event resolution RPC exists');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.attendance_logs')), false), 'Attendance logs use RLS');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000801', 'authenticated', 'authenticated', 'attendance-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000802', 'authenticated', 'authenticated', 'attendance-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000803', 'authenticated', 'authenticated', 'attendance-other@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000000801'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000000801'::uuid,
  '00000000-0000-4000-8000-000000000802'::uuid,
  '00000000-0000-4000-8000-000000000803'::uuid
);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000802', 'ATT-001', 'Attendance', 'Employee', 'attendance-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000803', 'ATT-002', 'Other', 'Employee', 'attendance-other@example.test', '2024-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';

select set_config('test.import_id', public.create_attendance_import('demo.csv', 'text/csv', repeat('a', 64))::text, true);
select extensions.is(
  public.process_attendance_event(
    current_setting('test.import_id')::uuid, 'DEV-001', 'EVT-001', '2026-08-24',
    '2026-08-24 08:16:00+08'::timestamptz, '2026-08-24 17:00:00+08'::timestamptz,
    'attendance', '{"adapterVersion":"csv-xlsx-v1","rowNumber":2}'::jsonb
  ), 'unmatched', 'An unmapped device ID enters the review queue'
);

select extensions.is((select count(*) from public.attendance_unmatched_events), 1::bigint, 'Unknown ID has one queue event');
select set_config('test.log_id', public.resolve_attendance_unmatched_event(
  (select id from public.attendance_unmatched_events limit 1),
  '00000000-0000-4000-8000-000000000901'::uuid
)::text, true);
select extensions.is((select status from public.attendance_logs where id::text = current_setting('test.log_id')), 'late', 'Configured late status is calculated');
select extensions.is(
  public.process_attendance_event(
    current_setting('test.import_id')::uuid, 'DEV-001', 'EVT-001', '2026-08-24',
    '2026-08-24 08:16:00+08'::timestamptz, '2026-08-24 17:00:00+08'::timestamptz,
    'attendance', '{"adapterVersion":"csv-xlsx-v1","rowNumber":2}'::jsonb
  ), 'duplicate', 'Replayed source event is idempotent'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000802';
select extensions.is((select count(*) from public.attendance_logs), 1::bigint, 'Employee reads only own attendance log');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000803';
select extensions.is((select count(*) from public.attendance_logs), 0::bigint, 'Other employee cannot read attendance log');

select * from extensions.finish();

rollback;
