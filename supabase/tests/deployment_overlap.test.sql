begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(8);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000002201', 'authenticated', 'authenticated', 'overlap-hr@example.test', now(), now());
update public.user_roles set role = 'hr_personnel'::public.app_role where user_id = '00000000-0000-4000-8000-000000002201'::uuid;

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000002211', 'OVL-001', 'Overlap', 'One', 'overlap-one@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000002212', 'OVL-002', 'Overlap', 'Two', 'overlap-two@example.test', '2024-01-01');

-- A legacy overlap that existed before the rule: same employee, same day.
alter table public.deployments disable trigger deployments_validate_no_overlap;
insert into public.deployments (id, employee_id, location, assignment_role, starts_on, status, notes, created_by_user_id, updated_by_user_id)
values
  ('00000000-0000-4000-8000-000000002291', '00000000-0000-4000-8000-000000002212', 'Legacy A', 'Legacy A', '2099-05-01', 'scheduled', 'a', '00000000-0000-4000-8000-000000002201', '00000000-0000-4000-8000-000000002201'),
  ('00000000-0000-4000-8000-000000002292', '00000000-0000-4000-8000-000000002212', 'Legacy B', 'Legacy B', '2099-05-01', 'scheduled', 'b', '00000000-0000-4000-8000-000000002201', '00000000-0000-4000-8000-000000002201');
alter table public.deployments enable trigger deployments_validate_no_overlap;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002201';

select extensions.lives_ok(
  $$select public.create_deployment_group('Plaza', null, '2099-01-10', '2099-01-12', 'Special Event', 'Fiesta / Major Event', '[{"employeeId":"00000000-0000-4000-8000-000000002211","task":"Deployed"}]'::jsonb)$$,
  'HR deploys an employee for three days'
);
select extensions.throws_ok(
  $$select public.create_deployment_group('Market', null, '2099-01-12', null, 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000002211","task":"Deployed"}]'::jsonb)$$,
  '22023', 'An employee already has a scheduled or ongoing deployment.', 'A scheduled deployment blocks another assignment'
);
select extensions.throws_ok(
  $$select public.create_deployment_group('Market', null, '2099-01-08', '2099-01-10', 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000002211","task":"Deployed"}]'::jsonb)$$,
  '22023', 'An employee already has a scheduled or ongoing deployment.', 'A scheduled deployment blocks a range ending on its first day'
);
select extensions.throws_ok(
  $$select public.create_deployment_group('Market', null, '2099-01-13', null, 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000002211","task":"Deployed"}]'::jsonb)$$,
  '22023', 'An employee already has a scheduled or ongoing deployment.', 'A scheduled deployment blocks later assignments until it is closed'
);
select extensions.lives_ok(
  $$select public.cancel_deployment(
      (select id from public.deployments where employee_id = '00000000-0000-4000-8000-000000002211' and location = 'Plaza'),
      (select updated_at from public.deployments where employee_id = '00000000-0000-4000-8000-000000002211' and location = 'Plaza'))$$,
  'HR cancels the three-day deployment'
);
select extensions.lives_ok(
  $$select public.create_deployment_group('Hall', null, '2099-01-11', null, 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000002211","task":"Deployed"}]'::jsonb)$$,
  'A cancelled deployment no longer blocks the day'
);
select extensions.lives_ok(
  $$select public.update_deployment_details('00000000-0000-4000-8000-000000002291'::uuid,
      (select updated_at from public.deployments where id = '00000000-0000-4000-8000-000000002291'),
      'Legacy A', '2099-05-01', null, 'Public Assembly', 'Rally', 'Reserve/Standby')$$,
  'Editing only the task of a legacy overlapping deployment still works'
);
select extensions.throws_ok(
  $$select public.create_deployment_group('Market', null, '2099-01-13', null, 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000002212","task":"Deployed"}]'::jsonb)$$,
  '22023', 'An employee already has a scheduled or ongoing deployment.', 'A legacy scheduled deployment also blocks a new assignment'
);

select * from extensions.finish();

rollback;
