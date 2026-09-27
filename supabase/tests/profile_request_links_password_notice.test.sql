begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(11);

select extensions.has_function('public', 'record_password_changed', array[]::text[], 'Password-changed notice RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000901', 'authenticated', 'authenticated', 'notice-admin@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000902', 'authenticated', 'authenticated', 'notice-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000903', 'authenticated', 'authenticated', 'notice-other@example.test', now(), now());

update public.user_roles
set role = case user_id when '00000000-0000-4000-8000-000000000901'::uuid then 'system_administrator'::public.app_role else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000000901'::uuid, '00000000-0000-4000-8000-000000000902'::uuid, '00000000-0000-4000-8000-000000000903'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-000000000902', 'NOTE-001', 'Notice', 'Employee', 'notice-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000912', '00000000-0000-4000-8000-000000000903', 'NOTE-002', 'Other', 'Employee', 'notice-other@example.test', '2024-01-01');
insert into public.qualifications (employee_id, name, institution, awarded_on)
values
  ('00000000-0000-4000-8000-000000000911', 'Civil Service Professional', 'CSC', '2020-01-01'),
  ('00000000-0000-4000-8000-000000000912', 'Other Eligibility', 'CSC', '2020-01-01');
insert into public.training_records (employee_id, course_name, provider, completed_on)
values
  ('00000000-0000-4000-8000-000000000911', 'Basic Course', 'Academy', '2021-01-01'),
  ('00000000-0000-4000-8000-000000000912', 'Other Course', 'Academy', '2021-01-01');
insert into public.service_history (employee_id, employment_title, started_on)
values
  ('00000000-0000-4000-8000-000000000911', 'Patrolman', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000912', 'Other Patrolman', '2024-01-01');

-- My Profile: an employee reads only their own eligibility, training and service history.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
select extensions.is((select array_agg(name) from public.qualifications), array['Civil Service Professional'], 'An employee reads only their own qualifications');
select extensions.is((select array_agg(course_name) from public.training_records), array['Basic Course'], 'An employee reads only their own training records');
select extensions.is((select array_agg(employment_title) from public.service_history), array['Patrolman'], 'An employee reads only their own service history');

-- A decision notification links to the specific request.
select extensions.lives_ok(
  $$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000921'::uuid, null, '[{"kind":"contact","field":"phone","originalValue":null,"requestedValue":"+63 917 000 0000"}]'::jsonb, '[]'::jsonb)$$,
  'Employee submits a profile change request'
);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
select extensions.lives_ok($$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000921'::uuid, 'rejected', 'Provide proof.')$$, 'Administrator rejects the request');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
select extensions.is(
  (select link from public.notifications where type = 'profile_change_decision'),
  '/employee/profile/change-requests/00000000-0000-4000-8000-000000000921',
  'The decision notification opens that request'
);

-- Password-changed notice.
set local role anon;
select extensions.throws_ok($$select public.record_password_changed()$$, '42501', null, 'Anonymous users cannot record a password change');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
select extensions.lives_ok($$select public.record_password_changed()$$, 'A signed-in user records their password change');
select extensions.is(
  (select count(*) from public.notifications where type = 'password_changed' and title = 'Password changed' and body = 'Your account password was changed.'),
  1::bigint,
  'The user sees a Password changed notification'
);

set local role postgres;
select extensions.is(
  (select array_agg(distinct recipient_user_id) from public.notifications where type = 'password_changed'),
  array['00000000-0000-4000-8000-000000000902'::uuid],
  'The notice is only for the caller'
);

select * from extensions.finish();

rollback;
