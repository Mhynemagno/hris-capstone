begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(10);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000e01', 'authenticated', 'authenticated', 'unit-admin@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000e02', 'authenticated', 'authenticated', 'unit-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000e03', 'authenticated', 'authenticated', 'unit-employee@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000000e01'::uuid then 'system_administrator'::public.app_role
  when '00000000-0000-4000-8000-000000000e02'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end
where user_id in ('00000000-0000-4000-8000-000000000e01', '00000000-0000-4000-8000-000000000e02', '00000000-0000-4000-8000-000000000e03');

set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000e01';
select extensions.lives_ok($$ insert into public.unit_stations (name) values ('PGTAP Precinct 1'), ('PGTAP Precinct 2'), ('PGTAP Typo Precnct') $$, 'An administrator adds unit stations');
select extensions.lives_ok($$ update public.unit_stations set is_active = false where name = 'PGTAP Precinct 2' $$, 'An administrator deactivates a unit station');
select extensions.is((select count(*) from public.unit_stations where name like 'PGTAP %'), 3::bigint, 'An administrator still sees deactivated stations');
select extensions.lives_ok($$ update public.unit_stations set name = 'PGTAP Typo Precinct' where name = 'PGTAP Typo Precnct' $$, 'An unused station can be renamed');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000e02';
select extensions.throws_ok($$ insert into public.unit_stations (name) values ('PGTAP HR Station') $$, '42501', null, 'HR cannot change the catalogue');
select extensions.is((select count(*) from public.unit_stations where name like 'PGTAP %'), 2::bigint, 'Other roles see only active stations');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000e03';
select extensions.is((select count(*) from public.unit_stations where name = 'PGTAP Precinct 2'), 0::bigint, 'An employee cannot see a deactivated station');

set local role postgres;
select extensions.is((select count(*) from public.audit_logs where entity_type = 'unit_stations' and metadata ->> 'name' like 'PGTAP %'), 5::bigint, 'Every catalogue change is audited');

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on, unit_station)
values ('00000000-0000-4000-8000-000000000e11', 'UNIT-001', 'Unit', 'Holder', 'unit-holder@example.test', '2024-01-01', 'PGTAP Precinct 1');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000e01';
select extensions.throws_ok($$ update public.unit_stations set name = 'PGTAP Precinct One' where name = 'PGTAP Precinct 1' $$, '23503', null, 'A station used on a personnel record cannot be renamed');
select extensions.lives_ok($$ update public.unit_stations set is_active = false where name = 'PGTAP Precinct 1' $$, 'A used station can still be deactivated');

select * from extensions.finish();

rollback;
