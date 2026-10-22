begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(3);

-- Promotion dockets were retired with HR-posted criteria (20261022120000_promotion_auto_evaluation.sql).
-- Badge login for personnel records of every staff role remains covered here.

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002601', 'authenticated', 'authenticated', 'docket-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002602', 'authenticated', 'authenticated', 'docket-sysad@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002603', 'authenticated', 'authenticated', 'docket-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002604', 'authenticated', 'authenticated', 'docket-other@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002605', 'authenticated', 'authenticated', 'docket-top@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000002601'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000002602'::uuid then 'system_administrator'::public.app_role
  else 'employee'::public.app_role
end where user_id between '00000000-0000-4000-8000-000000002601'::uuid and '00000000-0000-4000-8000-000000002605'::uuid;

insert into public.ranks (id, name, code, sort_order, is_active) overriding system value
values
  (9921, 'Docket Patrolman', 'DPT', 9921, true),
  (9922, 'Docket Corporal', 'DPC', 9922, true),
  (9923, 'Docket Senior', 'DPS', 9923, true);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, rank_id, employment_started_on)
values
  ('00000000-0000-4000-8000-000000002611', '00000000-0000-4000-8000-000000002601', 'DOCKET-HR', 'Docket', 'HR', 'docket-hr@example.test', 9922, '2010-01-01'),
  ('00000000-0000-4000-8000-000000002612', '00000000-0000-4000-8000-000000002602', 'DOCKET-SA', 'Docket', 'Sysad', 'docket-sysad@example.test', 9922, '2010-01-01'),
  ('00000000-0000-4000-8000-000000002613', '00000000-0000-4000-8000-000000002603', 'DOCKET-EMP', 'Docket', 'Employee', 'docket-employee@example.test', 9921, '2010-01-01'),
  ('00000000-0000-4000-8000-000000002614', '00000000-0000-4000-8000-000000002604', 'DOCKET-OTHER', 'Docket', 'Other', 'docket-other@example.test', 9921, '2010-01-01'),
  ('00000000-0000-4000-8000-000000002615', '00000000-0000-4000-8000-000000002605', 'DOCKET-TOP', 'Docket', 'Top', 'docket-top@example.test', 9923, '2010-01-01');

set local role postgres;
select extensions.is(public.resolve_login_identifier('employee', 'DOCKET-HR'), 'docket-hr@example.test', 'An active HR personnel record can use badge login');
select extensions.is(public.resolve_login_identifier('employee', 'DOCKET-SA'), 'docket-sysad@example.test', 'An active SysAd personnel record can use badge login');
update public.user_roles set role = 'management'::public.app_role where user_id = '00000000-0000-4000-8000-000000002604';
select extensions.is(public.resolve_login_identifier('employee', 'DOCKET-OTHER'), 'docket-other@example.test', 'An active management personnel record can still use badge login');

select * from extensions.finish();

rollback;
