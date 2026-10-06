begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(11);

select extensions.has_column('public', 'employees', 'sss_number', 'Employees have an SSS number');
select extensions.has_column('public', 'employees', 'philhealth_number', 'Employees have a PhilHealth number');
select extensions.has_function('public', 'update_my_government_ids', array['text', 'text'], 'Employees can save their own government ID numbers');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001701', 'authenticated', 'authenticated', 'gov-ids-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001702', 'authenticated', 'authenticated', 'gov-ids-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001703', 'authenticated', 'authenticated', 'gov-ids-applicant@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000001701'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000001702'::uuid then 'employee'::public.app_role
  else 'applicant'::public.app_role
end where user_id in ('00000000-0000-4000-8000-000000001701'::uuid, '00000000-0000-4000-8000-000000001702'::uuid, '00000000-0000-4000-8000-000000001703'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000001711', '00000000-0000-4000-8000-000000001702', 'GOV-001', 'Gov', 'Ids', 'gov-ids-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000001712', null, 'GOV-002', 'Other', 'Person', 'gov-ids-other@example.test', '2024-01-01');

select extensions.throws_ok(
  $$update public.employees set sss_number = '12345' where id = '00000000-0000-4000-8000-000000001712'$$,
  '23514', null, 'An SSS number must have 10 digits'
);
select extensions.throws_ok(
  $$update public.employees set philhealth_number = '12-3456' where id = '00000000-0000-4000-8000-000000001712'$$,
  '23514', null, 'A PhilHealth number is stored as 12 digits'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001702';
select public.update_my_government_ids('34-1234567-8', '12-345678901-2');
select extensions.is(
  (select sss_number from public.employees where id = '00000000-0000-4000-8000-000000001711'),
  '3412345678', 'The employee saves their SSS number, stored as digits'
);
select extensions.is(
  (select philhealth_number from public.employees where id = '00000000-0000-4000-8000-000000001711'),
  '123456789012', 'The employee saves their PhilHealth number, stored as digits'
);
select extensions.throws_ok($$select public.update_my_government_ids('123', null)$$, '22023', null, 'A short SSS number is rejected with a clear error');
select public.update_my_government_ids('', null);
select extensions.ok(
  (select sss_number is null and philhealth_number is null from public.employees where id = '00000000-0000-4000-8000-000000001711'),
  'Leaving a number blank clears it'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001703';
select extensions.throws_ok($$select public.update_my_government_ids('3412345678', null)$$, '42501', null, 'Only an employee can save government ID numbers');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001701';
update public.employees set sss_number = '1111111111' where id = '00000000-0000-4000-8000-000000001712';
select extensions.is(
  (select sss_number from public.employees where id = '00000000-0000-4000-8000-000000001712'),
  '1111111111', 'HR can edit the numbers on a personnel record'
);

select * from extensions.finish();

rollback;
