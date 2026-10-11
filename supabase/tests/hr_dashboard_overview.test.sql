begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(7);

select extensions.has_function('public', 'get_hr_dashboard_overview', array[]::text[], 'HR has a dashboard overview RPC');

-- Isolate from seed data: only these employees are active during the test.
update public.employees set employment_status = 'retired';

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
  ('00000000-0000-4000-8000-000000003214', 'OVR-004', 'Di', 'Civilian', 'ovr4@example.test', '2020-01-01', null, null, 'active');

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

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003202';
select extensions.throws_ok($$select public.get_hr_dashboard_overview()$$, '42501', null, 'Only HR can read the overview');

select * from extensions.finish();

rollback;
