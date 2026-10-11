begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

select extensions.has_function('public', 'get_hr_dashboard_overview', array[]::text[], 'HR has a dashboard overview RPC');

-- Isolate from seed data: only these employees are active during the test.
update public.employees set employment_status = 'retired';
delete from public.attendance_logs where attendance_date = (now() at time zone 'Asia/Manila')::date;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000003201', 'authenticated', 'authenticated', 'overview-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003202', 'authenticated', 'authenticated', 'overview-employee@example.test', now(), now());
update public.user_roles set role = case user_id when '00000000-0000-4000-8000-000000003201'::uuid then 'hr_personnel'::public.app_role else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000003201'::uuid, '00000000-0000-4000-8000-000000003202'::uuid);

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on, gender, rank_id, employment_status)
values
  ('00000000-0000-4000-8000-000000003211', 'OVR-001', 'Ana', 'Major', 'ovr1@example.test', '2020-01-01', 'female', (select id from public.ranks where code = 'PMAJ'), 'active'),
  ('00000000-0000-4000-8000-000000003212', 'OVR-002', 'Ben', 'Patrol', 'ovr2@example.test', '2020-01-01', 'male', (select id from public.ranks where code = 'PAT'), 'active'),
  ('00000000-0000-4000-8000-000000003213', 'OVR-003', 'Cy', 'Patrol', 'ovr3@example.test', '2020-01-01', 'male', (select id from public.ranks where code = 'PAT'), 'active'),
  ('00000000-0000-4000-8000-000000003214', 'OVR-004', 'Di', 'Civilian', 'ovr4@example.test', '2020-01-01', null, null, 'active'),
  ('00000000-0000-4000-8000-000000003215', 'OVR-005', 'Ed', 'Retired', 'ovr5@example.test', '2020-01-01', 'male', null, 'active');
update public.employees set employment_status = 'retired' where id = '00000000-0000-4000-8000-000000003215';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003201';

select extensions.is(
  (select jsonb_agg(item ->> 'code') from jsonb_array_elements(public.get_hr_dashboard_overview() -> 'personnelByRank') item),
  '["PMAJ", "PAT", null]'::jsonb,
  'Ranks are ordered highest first, with unranked personnel last'
);
select extensions.is(
  (select (item ->> 'count')::int from jsonb_array_elements(public.get_hr_dashboard_overview() -> 'personnelByRank') item where item ->> 'code' = 'PAT'),
  2, 'Rank counts are per rank'
);
select extensions.is(
  public.get_hr_dashboard_overview() -> 'personnelByGender',
  '[{"label": "male", "count": 2}, {"label": "female", "count": 1}, {"label": "unspecified", "count": 1}]'::jsonb,
  'Gender counts cover male, female and unspecified'
);
select extensions.ok(
  (public.get_hr_dashboard_overview() -> 'attendanceToday') ?& array['present', 'late', 'incomplete', 'absent', 'onLeave'],
  'Today''s attendance has every bucket'
);
select extensions.is(
  (public.get_hr_dashboard_overview() -> 'attendanceToday' ->> 'present')::int, 0, 'No one has a log yet today'
);
select extensions.is(
  (public.get_hr_dashboard_overview() -> 'attendanceToday' ->> 'absent')::int, 0, 'Nobody is absent before anyone has scanned today'
);

-- Today's logs: present, late, a hand-recorded absence, and a retired officer's stray log. OVR-004 has none.
set local role postgres;
insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, capture_method)
select log.employee_id, (select id from public.attendance_integration_settings where adapter_key = 'face_recognition'), log.source_event_id, log.external_id,
  (now() at time zone 'Asia/Manila')::date, case when log.status = 'absent' then null else now() end, case when log.status = 'absent' then null else now() end, log.status, 'face_recognition'
from (values
  ('00000000-0000-4000-8000-000000003211'::uuid, 'ovr:1', 'OVR-001', 'present'),
  ('00000000-0000-4000-8000-000000003212'::uuid, 'ovr:2', 'OVR-002', 'late'),
  ('00000000-0000-4000-8000-000000003213'::uuid, 'ovr:3', 'OVR-003', 'absent'),
  ('00000000-0000-4000-8000-000000003215'::uuid, 'ovr:5', 'OVR-005', 'present')
) as log(employee_id, source_event_id, external_id, status);
set local role authenticated;

select extensions.is(
  public.get_hr_dashboard_overview() -> 'attendanceToday',
  '{"present": 1, "late": 1, "incomplete": 0, "absent": 2, "onLeave": 0}'::jsonb,
  'Today counts active personnel only; recorded absences and no-shows are both absent'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003202';
select extensions.throws_ok($$select public.get_hr_dashboard_overview()$$, '42501', null, 'Only HR can read the overview');

select * from extensions.finish();

rollback;
