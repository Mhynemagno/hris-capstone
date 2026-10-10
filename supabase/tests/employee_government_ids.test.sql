begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(14);

select extensions.has_column('public', 'employees', 'sss_number', 'Employees keep their SSS number column');
select extensions.has_column('public', 'employees', 'philhealth_number', 'Employees have a PhilHealth number');
select extensions.has_column('public', 'employees', 'gsis_number', 'Employees have a GSIS number');
select extensions.has_column('public', 'employees', 'pagibig_number', 'Employees have a Pag-IBIG number');
select extensions.has_function('public', 'update_my_government_ids', array['text', 'text', 'text'], 'Employees can save their own government ID numbers');

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
  $$update public.employees set gsis_number = '12345' where id = '00000000-0000-4000-8000-000000001712'$$,
  '23514', null, 'A GSIS number must have 11 digits'
);
select extensions.throws_ok(
  $$update public.employees set pagibig_number = '1234-5678-9012' where id = '00000000-0000-4000-8000-000000001712'$$,
  '23514', null, 'A Pag-IBIG number is stored as 12 digits'
);
select extensions.throws_ok(
  $$update public.employees set philhealth_number = '12-3456' where id = '00000000-0000-4000-8000-000000001712'$$,
  '23514', null, 'A PhilHealth number is stored as 12 digits'
);

update public.employees set sss_number = '3412345678' where id = '00000000-0000-4000-8000-000000001711';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001702';
select public.update_my_government_ids('12-345678901-2', '12345678901', '1234-5678-9012');
select extensions.is(
  (select array[philhealth_number, gsis_number, pagibig_number, sss_number] from public.employees where id = '00000000-0000-4000-8000-000000001711'),
  array['123456789012', '12345678901', '123456789012', '3412345678'],
  'The employee saves PhilHealth, GSIS and Pag-IBIG as digits and the hidden SSS number is untouched'
);
select extensions.throws_ok($$select public.update_my_government_ids(null, '123', null)$$, '22023', null, 'A short GSIS number is rejected');
select extensions.throws_ok($$select public.update_my_government_ids(null, null, '1234')$$, '22023', null, 'A short Pag-IBIG number is rejected');
select public.update_my_government_ids('', '', '');
select extensions.ok(
  (select philhealth_number is null and gsis_number is null and pagibig_number is null and sss_number = '3412345678' from public.employees where id = '00000000-0000-4000-8000-000000001711'),
  'Leaving the numbers blank clears them and keeps the SSS number'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001703';
select extensions.throws_ok($$select public.update_my_government_ids('123456789012', null, null)$$, '42501', null, 'Only an employee can save government ID numbers');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001701';
update public.employees set gsis_number = '11111111111' where id = '00000000-0000-4000-8000-000000001712';
select extensions.is(
  (select gsis_number from public.employees where id = '00000000-0000-4000-8000-000000001712'),
  '11111111111', 'HR can edit the numbers on a personnel record'
);

select * from extensions.finish();

rollback;
