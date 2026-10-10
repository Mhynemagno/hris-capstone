begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(2);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000002501', 'authenticated', 'authenticated', 'end-date-hr@example.test', now(), now());
update public.user_roles set role = 'hr_personnel'::public.app_role where user_id = '00000000-0000-4000-8000-000000002501'::uuid;
insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000002511', 'END-001', 'End', 'Date', 'end-date@example.test', '2024-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002501';
select public.create_deployment('00000000-0000-4000-8000-000000002511'::uuid, 'Plaza', null, null, 'Plaza', '2099-03-01', '2099-03-05', 'scheduled', 'Fiesta', 'Special Event', 'Fiesta / Major Event');

select extensions.lives_ok(
  $$select public.update_deployment(
      (select id from public.deployments where employee_id = '00000000-0000-4000-8000-000000002511'),
      (select updated_at from public.deployments where employee_id = '00000000-0000-4000-8000-000000002511'),
      'Plaza', null, null, 'Plaza', '2099-03-01', null, 'scheduled', 'Now one day', 'Special Event', 'Fiesta / Major Event')$$,
  'HR clears the end date to make it a one-day deployment'
);
select extensions.ok(
  (select ends_on is null from public.deployments where employee_id = '00000000-0000-4000-8000-000000002511'),
  'A cleared end date stays cleared'
);

select * from extensions.finish();

rollback;
