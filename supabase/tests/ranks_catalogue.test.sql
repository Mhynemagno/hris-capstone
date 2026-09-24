begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(14);

select has_table('public', 'ranks', 'ranks table exists');
select hasnt_table('public', 'positions', 'positions table is gone');
select hasnt_column('public', 'ranks', 'department_id', 'ranks are not department-specific');
select has_column('public', 'ranks', 'code', 'ranks have a code');
select has_column('public', 'employees', 'rank_id', 'employees reference a rank');
select hasnt_column('public', 'employees', 'rank', 'free-text rank column removed');
select hasnt_column('public', 'employees', 'position_id', 'employees.position_id removed');
select has_column('public', 'job_openings', 'rank_id', 'job openings reference a rank');
select has_column('public', 'employees', 'gender', 'employees.gender exists');
select has_column('public', 'applicants', 'gender', 'applicants.gender exists');
select hasnt_function('public', 'delete_department', array['bigint'], 'department delete RPC removed');
select hasnt_function('public', 'delete_position', array['bigint'], 'position delete RPC removed');

insert into public.employees (employee_number, first_name, last_name, personal_email, employment_started_on)
values ('RANK-TEST-1', 'Rank', 'Tester', 'rank.tester@example.test', current_date);
select throws_ok(
  $$ update public.employees set employment_status = 'inactive' where employee_number = 'RANK-TEST-1' $$,
  '23514', null, 'only active / on_leave statuses are allowed'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'reporting') and p.prosrc ~* 'position'),
  0, 'no function body still mentions position'
);

select * from finish();
rollback;
