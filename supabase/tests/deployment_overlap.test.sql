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
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Plaza', null, null, 'Plaza', '2099-01-10', '2099-01-12', 'scheduled', 'Fiesta', 'Special Event', 'Fiesta / Major Event')$$,
  'HR deploys an employee for three days'
);
select extensions.throws_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Market', null, null, 'Market', '2099-01-12', null, 'scheduled', 'Rally', 'Public Assembly', 'Rally')$$,
  '23P01', 'This employee is already deployed on that date.', 'A one-day deployment inside an active range is rejected'
);
select extensions.throws_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Market', null, null, 'Market', '2099-01-08', '2099-01-10', 'ongoing', 'Rally', 'Public Assembly', 'Rally')$$,
  '23P01', 'This employee is already deployed on that date.', 'A range touching the first day is rejected'
);
select extensions.lives_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Market', null, null, 'Market', '2099-01-13', null, 'scheduled', 'Rally', 'Public Assembly', 'Rally')$$,
  'The day after the range is free'
);
select extensions.lives_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002211'::uuid, 'Hall', null, null, 'Hall', '2099-01-11', null, 'cancelled', 'Called off', 'Public Assembly', 'Rally')$$,
  'A cancelled deployment on a busy day is allowed'
);
select extensions.lives_ok(
  $$select public.create_deployment('00000000-0000-4000-8000-000000002212'::uuid, 'Plaza', null, null, 'Plaza', '2099-01-11', null, 'scheduled', 'Other person', 'Special Event', 'Fiesta / Major Event')$$,
  'Another employee can be deployed on the same day'
);
select extensions.lives_ok(
  $$select public.update_deployment('00000000-0000-4000-8000-000000002291'::uuid,
      (select updated_at from public.deployments where id = '00000000-0000-4000-8000-000000002291'),
      'Legacy A', null, null, 'Legacy A', '2099-05-01', null, 'scheduled', 'remarks changed', null, null)$$,
  'Editing only the remarks of a legacy overlapping deployment still works'
);
select extensions.throws_ok(
  $$select public.update_deployment(
      (select id from public.deployments where location = 'Market' and starts_on = '2099-01-13'),
      (select updated_at from public.deployments where location = 'Market' and starts_on = '2099-01-13'),
      'Market', null, null, 'Market', '2099-01-11', null, 'scheduled', 'moved', 'Public Assembly', 'Rally')$$,
  '23P01', 'This employee is already deployed on that date.', 'Moving a deployment onto a busy day is rejected'
);

select * from extensions.finish();

rollback;
