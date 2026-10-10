begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(5);

select extensions.is((select eligible_gender from public.leave_types where lower(name) = 'maternity leave'), 'female', 'Maternity Leave is for female employees');
select extensions.is((select eligible_gender from public.leave_types where lower(name) = 'paternity leave'), 'male', 'Paternity Leave is for male employees');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002401', 'authenticated', 'authenticated', 'leave-gender-male@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002402', 'authenticated', 'authenticated', 'leave-gender-unset@example.test', now(), now());
update public.user_roles set role = 'employee'::public.app_role
where user_id in ('00000000-0000-4000-8000-000000002401'::uuid, '00000000-0000-4000-8000-000000002402'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on, gender)
values
  ('00000000-0000-4000-8000-000000002411', '00000000-0000-4000-8000-000000002401', 'LVG-001', 'Male', 'Officer', 'leave-gender-male@example.test', '2024-01-01', 'male'),
  ('00000000-0000-4000-8000-000000002412', '00000000-0000-4000-8000-000000002402', 'LVG-002', 'Unset', 'Officer', 'leave-gender-unset@example.test', '2024-01-01', null);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002401';

select extensions.throws_ok(
  $$select public.submit_leave_request('00000000-0000-4000-8000-000000002441'::uuid,
      (select id from public.leave_types where lower(name) = 'maternity leave'), '2099-02-01', '2099-02-02', 'Request', '[]'::jsonb)$$,
  '22023', 'Maternity Leave is only available to female employees.', 'A male employee cannot request Maternity Leave'
);
select extensions.lives_ok(
  $$select public.submit_leave_request('00000000-0000-4000-8000-000000002442'::uuid,
      (select id from public.leave_types where lower(name) = 'paternity leave'), '2099-02-01', '2099-02-02', 'Newborn', '[]'::jsonb)$$,
  'A male employee can request Paternity Leave'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002402';
select extensions.throws_ok(
  $$select public.submit_leave_request('00000000-0000-4000-8000-000000002443'::uuid,
      (select id from public.leave_types where lower(name) = 'paternity leave'), '2099-02-01', '2099-02-02', 'Newborn', '[]'::jsonb)$$,
  '22023', 'Paternity Leave is only available to male employees.', 'An employee without a recorded gender cannot request a gender-specific type'
);

select * from extensions.finish();

rollback;
