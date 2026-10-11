begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(17);

select extensions.has_table('public', 'employee_promotion_dockets', 'Employee promotion dockets table exists');
select extensions.has_function('public', 'submit_employee_promotion_docket', array['uuid', 'text'], 'Employee promotion docket RPC exists');

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

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002601';
select set_config('test.docket_criterion', public.create_promotion_criterion(9922, 1, null, '[]'::jsonb)::text, true);
set local role postgres;
insert into public.promotion_criteria (target_rank_id, minimum_years_of_service, is_active, created_by_user_id, updated_by_user_id)
values (9923, 3, true, '00000000-0000-4000-8000-000000002601', '00000000-0000-4000-8000-000000002601');
select set_config('test.unready_criterion', (select id::text from public.promotion_criteria where target_rank_id = 9923), true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002603';
select extensions.is(public.get_my_promotion_readiness() ->> 'targetRankName', 'Docket Corporal', 'An employee sees the active criterion for the immediate next rank');
select extensions.ok((public.get_my_promotion_readiness() -> 'readiness' ->> 'isReady')::boolean, 'The ready employee is eligible to submit a docket');
select extensions.is(public.get_my_promotion_readiness() ->> 'criterionId', current_setting('test.docket_criterion'), 'Readiness returns the rank-matched criterion ID');
select extensions.throws_ok($$select public.submit_employee_promotion_docket(current_setting('test.unready_criterion')::uuid, 'Ready')$$, 'P0001', null, 'An employee cannot submit a nonmatching or unready promotion docket');
select extensions.throws_ok($$select public.submit_employee_promotion_docket(current_setting('test.docket_criterion')::uuid, '   ')$$, '22023', null, 'A promotion docket requires nonblank remarks');
select set_config('test.docket_id', public.submit_employee_promotion_docket(current_setting('test.docket_criterion')::uuid, '  Ready for rank review.  ')::text, true);
select extensions.is((select remarks from public.employee_promotion_dockets where id = current_setting('test.docket_id')::uuid), 'Ready for rank review.', 'Docket remarks are trimmed before storage');
select extensions.is(public.get_my_promotion_readiness() -> 'docket' ->> 'id', current_setting('test.docket_id'), 'Readiness returns the employee docket for its matching criterion');
select extensions.throws_ok($$select public.submit_employee_promotion_docket(current_setting('test.docket_criterion')::uuid, 'Second request')$$, '23505', null, 'An employee cannot submit a duplicate docket for the same criterion');
select extensions.is((select count(*)::integer from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000002603'::uuid and type = 'promotion_docket_submitted'), 1, 'Submitting a docket creates an employee notification');
select extensions.is((select employment_status from public.employees where id = '00000000-0000-4000-8000-000000002613'::uuid), 'active', 'Submitting a docket does not change employment status');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002604';
select extensions.is_empty($$select * from public.employee_promotion_dockets$$, 'An employee cannot read another employee docket');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002601';
select extensions.is((select count(*)::integer from public.employee_promotion_dockets), 1, 'HR can read submitted promotion dockets');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002605';
select extensions.ok(public.get_my_promotion_readiness() is null, 'An employee at the top rank has no target criterion');

set local role postgres;
select extensions.is(public.resolve_login_identifier('employee', 'DOCKET-HR'), 'docket-hr@example.test', 'An active HR personnel record can use badge login');
select extensions.is(public.resolve_login_identifier('employee', 'DOCKET-SA'), 'docket-sysad@example.test', 'An active SysAd personnel record can use badge login');

select * from extensions.finish();

rollback;
