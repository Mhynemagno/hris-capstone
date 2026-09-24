begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(43);

select extensions.has_function('public', 'enroll_employee_face', array['uuid', 'real[]', 'integer', 'boolean'], 'Face enrollment RPC exists');
select extensions.has_function('public', 'record_face_attendance', array['uuid', 'real[]'], 'Face attendance RPC exists');
select extensions.ok(not has_table_privilege('authenticated', 'private.employee_face_enrollments', 'select'), 'Authenticated users cannot select face descriptors');
select extensions.ok(not has_table_privilege('anon', 'private.employee_face_enrollments', 'select'), 'Anonymous users cannot select face descriptors');
select extensions.ok(not has_table_privilege('authenticated', 'private.face_attendance_scans', 'insert'), 'Authenticated users cannot write scan records directly');
select extensions.ok(not has_function_privilege('anon', 'public.record_face_attendance(uuid, real[])', 'execute'), 'Anonymous users cannot call the recognition RPC');
select extensions.col_is_null('private', 'employee_face_enrollments', 'enrolled_by_user_id', 'Deleting an HR account does not depend on enrollments it made');
select extensions.col_is_null('private', 'face_attendance_scans', 'recorded_by_user_id', 'Deleting an HR account does not depend on scans it ran');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000a01', 'authenticated', 'authenticated', 'face-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000a02', 'authenticated', 'authenticated', 'face-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000a03', 'authenticated', 'authenticated', 'face-other@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000a04', 'authenticated', 'authenticated', 'face-admin@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000a05', 'authenticated', 'authenticated', 'face-charlie@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000000a01'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000000a04'::uuid then 'system_administrator'::public.app_role
  else 'employee'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000000a01'::uuid,
  '00000000-0000-4000-8000-000000000a02'::uuid,
  '00000000-0000-4000-8000-000000000a03'::uuid,
  '00000000-0000-4000-8000-000000000a04'::uuid,
  '00000000-0000-4000-8000-000000000a05'::uuid
);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000a02', 'FACE-001', 'Face', 'Alpha', 'face-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000b02', '00000000-0000-4000-8000-000000000a03', 'FACE-002', 'Face', 'Bravo', 'face-other@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000b03', '00000000-0000-4000-8000-000000000a05', 'FACE-003', 'Face', 'Charlie', 'face-charlie@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000b04', null, 'FACE-004', 'Face', 'Unlinked', 'face-unlinked@example.test', '2024-01-01');

-- Synthetic descriptors (no real faces). Alpha = all 0.1, Bravo = all -0.1 (far from Alpha),
-- Charlie = Alpha shifted +/-0.05 (0.566 from Alpha, outside the 0.5 threshold).
create temporary table face_fixture (key text primary key, descriptor real[]) on commit drop;
insert into face_fixture values
  ('alpha', array_fill(0.1::real, array[128])),
  ('alpha_retake', array_fill(0.11::real, array[128])),
  ('alpha_probe', array_fill(0.12::real, array[128])),
  ('alpha_lookalike', array_fill(0.13::real, array[128])),
  ('bravo', array_fill(-0.1::real, array[128])),
  ('charlie', array_fill(0.15::real, array[64]) || array_fill(0.05::real, array[64])),
  ('between_alpha_charlie', array_fill(0.125::real, array[64]) || array_fill(0.075::real, array[64])),
  ('stranger', array_fill(0.0::real, array[128])),
  ('short', array_fill(0.1::real, array[127]));
grant select on face_fixture to authenticated;

set local role authenticated;

-- Authorization: employees and administrators cannot use the biometric RPCs.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a02';
select extensions.throws_ok($$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b01', (select descriptor from face_fixture where key = 'alpha'), 5, true) $$, '42501', null, 'An employee cannot enroll a face');
select extensions.throws_ok($$ select public.record_face_attendance(gen_random_uuid(), (select descriptor from face_fixture where key = 'alpha')) $$, '42501', null, 'An employee cannot run recognition');
select extensions.throws_ok($$ select * from public.list_face_enrollments() $$, '42501', null, 'An employee cannot list enrollments');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a04';
select extensions.throws_ok($$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b01', (select descriptor from face_fixture where key = 'alpha'), 5, true) $$, '42501', null, 'An administrator cannot enroll a face');

-- Enrollment validation and re-registration.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a01';
select extensions.is(public.enroll_employee_face('00000000-0000-4000-8000-000000000b01', (select descriptor from face_fixture where key = 'alpha'), 5, true) ->> 'status', 'enrolled', 'HR enrolls a consenting employee');
select extensions.throws_ok($$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b02', (select descriptor from face_fixture where key = 'bravo'), 5, false) $$, '22023', null, 'Enrollment requires confirmed consent');
select extensions.throws_ok($$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b02', (select descriptor from face_fixture where key = 'short'), 5, true) $$, '22023', null, 'A malformed descriptor is rejected');
select extensions.throws_ok($$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b04', (select descriptor from face_fixture where key = 'bravo'), 5, true) $$, 'P0001', null, 'An employee without a linked account cannot be registered');
select extensions.throws_ok($$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b02', (select descriptor from face_fixture where key = 'alpha_lookalike'), 5, true) $$, '23505', null, 'A face matching another employee cannot be enrolled');
select extensions.is(public.enroll_employee_face('00000000-0000-4000-8000-000000000b02', (select descriptor from face_fixture where key = 'bravo'), 5, true) ->> 'status', 'enrolled', 'A distinct face enrolls');
select extensions.is(public.enroll_employee_face('00000000-0000-4000-8000-000000000b03', (select descriptor from face_fixture where key = 'charlie'), 5, true) ->> 'status', 'enrolled', 'A third distinct face enrolls');
select extensions.is(public.enroll_employee_face('00000000-0000-4000-8000-000000000b01', (select descriptor from face_fixture where key = 'alpha_retake'), 5, true) ->> 'status', 're_registered', 'Re-registration replaces the enrollment');
select extensions.is((select count(*) from public.list_face_enrollments()), 3::bigint, 'Re-registration keeps one enrollment per employee');

set local role postgres;
select extensions.is((select count(*) from public.audit_logs where entity_type = 'employee_face_enrollments' and action in ('enrolled', 're_registered')), 4::bigint, 'Every enrollment is audited');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a01';

-- Matching threshold.
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c01', (select descriptor from face_fixture where key = 'stranger')) ->> 'outcome', 'not_recognized', 'A face beyond the threshold is not recognized');
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c02', (select descriptor from face_fixture where key = 'between_alpha_charlie')) ->> 'outcome', 'not_recognized', 'An ambiguous match between two employees is rejected');
select extensions.is((select count(*) from public.attendance_logs where capture_method = 'face_recognition'), 0::bigint, 'Rejected scans create no attendance');

select set_config('test.first_scan', public.record_face_attendance('00000000-0000-4000-8000-000000000c03', (select descriptor from face_fixture where key = 'alpha_probe'))::text, true);
select extensions.is(current_setting('test.first_scan')::jsonb ->> 'outcome', 'time_in', 'A face within the threshold records time in');
select extensions.is(current_setting('test.first_scan')::jsonb #>> '{employee,id}', '00000000-0000-4000-8000-000000000b01', 'The closest enrolled employee is identified');
select extensions.ok((select import_id is null and status = 'incomplete' and time_out is null from public.attendance_logs where capture_method = 'face_recognition'), 'Time in creates an incomplete face log without an import');
select extensions.is(current_setting('test.first_scan')::jsonb -> 'distance', 'null'::jsonb, 'Match distance is withheld from clients by default');

-- Idempotency and duplicate prevention.
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c03', (select descriptor from face_fixture where key = 'alpha_probe')) ->> 'outcome', 'time_in', 'A retried scan ID returns its original outcome');
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c04', (select descriptor from face_fixture where key = 'alpha_probe')) ->> 'outcome', 'already_recorded', 'An immediate rescan does not record time out');
select extensions.is((select count(*) from public.attendance_logs where capture_method = 'face_recognition'), 1::bigint, 'Repeated scans keep one face log');

set local role postgres;
update private.face_recognition_settings set min_time_out_minutes = 0;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a01';
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c05', (select descriptor from face_fixture where key = 'alpha_probe')) ->> 'outcome', 'time_out', 'A later scan records time out');
select extensions.ok((select time_out is not null and status in ('present', 'late') from public.attendance_logs where capture_method = 'face_recognition'), 'Time out applies the attendance status rules');
select extensions.is(public.record_face_attendance('00000000-0000-4000-8000-000000000c06', (select descriptor from face_fixture where key = 'alpha_probe')) ->> 'outcome', 'already_recorded', 'A completed day rejects further scans');

-- An import for a day already recorded by a face scan is a duplicate, not a second log.
set local role postgres;
insert into public.attendance_identity_mappings (employee_id, external_employee_id, created_by_user_id) values ('00000000-0000-4000-8000-000000000b01', 'FACEDEV-1', '00000000-0000-4000-8000-000000000a01');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a01';
select set_config('test.import_id', public.create_attendance_import('face-day.csv', 'text/csv', repeat('b', 64))::text, true);
select extensions.is(
  public.process_attendance_event(current_setting('test.import_id')::uuid, 'FACEDEV-1', 'EVT-FACE-DAY', (now() at time zone 'Asia/Ulaanbaatar')::date, now(), null, 'attendance', '{}'::jsonb),
  'duplicate', 'An import does not double-count a day recorded by a face scan'
);

-- Employee self-read isolation still applies to face logs.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a02';
select extensions.is((select count(*) from public.attendance_logs), 1::bigint, 'Employee reads their own face log');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a03';
select extensions.is((select count(*) from public.attendance_logs), 0::bigint, 'Another employee cannot read the face log');

-- Retention and deletion.
set local role postgres;
update public.profiles set is_active = false where id = '00000000-0000-4000-8000-000000000a03';
select extensions.ok(not exists (select 1 from private.employee_face_enrollments where employee_id = '00000000-0000-4000-8000-000000000b02'), 'Deactivating the account deletes the face descriptor');
-- The partial unique index is the final guard against a second face log for the same day.
select extensions.throws_ok($$ insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, status, capture_method) select employee_id, integration_id, 'face:duplicate', external_employee_id, attendance_date, time_in, 'incomplete', 'face_recognition' from public.attendance_logs where capture_method = 'face_recognition' $$, '23505', null, 'The database rejects a second face log for one employee and day');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000a01';
select extensions.throws_ok($$ select public.enroll_employee_face('00000000-0000-4000-8000-000000000b02', (select descriptor from face_fixture where key = 'bravo'), 5, true) $$, 'P0001', null, 'A deactivated account cannot be registered');
select extensions.lives_ok($$ select public.delete_employee_face_enrollment('00000000-0000-4000-8000-000000000b03') $$, 'HR deletes a face registration');
select extensions.throws_ok($$ select public.delete_employee_face_enrollment('00000000-0000-4000-8000-000000000b03') $$, 'P0001', null, 'Deleting a missing registration fails clearly');

select * from extensions.finish();

rollback;
