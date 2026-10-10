begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(6);

select extensions.is(
  (select array_agg(name || ':' || days_per_year::text order by name) from public.leave_types where is_active and lower(name) in ('mandatory leave', 'sick leave', 'vacation leave', 'special privilege leave')),
  array['Mandatory Leave:2', 'Sick Leave:15', 'Special Privilege Leave:3', 'Vacation Leave:15'],
  'The client''s leave set and yearly days are active'
);
select extensions.is((select description from public.leave_types where name = 'Special Privilege Leave'), 'Non-cumulative / Non-commutative.', 'Special Privilege Leave carries its note');
select extensions.has_function('public', 'get_employee_leave_balances', array['uuid', 'integer'], 'HR can see an employee''s leave credits');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002801', 'authenticated', 'authenticated', 'cards-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002802', 'authenticated', 'authenticated', 'cards-employee@example.test', now(), now());
update public.user_roles set role = case user_id when '00000000-0000-4000-8000-000000002801'::uuid then 'hr_personnel'::public.app_role else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000002801'::uuid, '00000000-0000-4000-8000-000000002802'::uuid);
insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on, gender)
values ('00000000-0000-4000-8000-000000002811', '00000000-0000-4000-8000-000000002802', 'CRD-001', 'Card', 'Officer', 'cards-employee@example.test', '2024-01-01', 'male');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002801';
select extensions.is(
  (select used_days from public.get_employee_leave_balances('00000000-0000-4000-8000-000000002811', 2099) where leave_type_id = (select id from public.leave_types where name = 'Vacation Leave')),
  0, 'HR reads the employee''s used days per leave type'
);
select extensions.is(
  (select count(*) from public.get_employee_leave_balances('00000000-0000-4000-8000-000000002811', 2099) where leave_type_id = (select id from public.leave_types where lower(name) = 'maternity leave')),
  0::bigint, 'Gender-specific types the employee cannot take are left out'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002802';
select extensions.throws_ok(
  $$select * from public.get_employee_leave_balances('00000000-0000-4000-8000-000000002811', 2099)$$,
  '42501', null, 'Only HR uses the employee balance lookup'
);

select * from extensions.finish();

rollback;
