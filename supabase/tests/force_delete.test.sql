begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(22);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000009701', 'authenticated', 'authenticated', 'force-admin@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009702', 'authenticated', 'authenticated', 'force-hr@example.test', now(), now());
update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000009701'::uuid then 'system_administrator'::public.app_role
  else 'hr_personnel'::public.app_role
end
where user_id in ('00000000-0000-4000-8000-000000009701', '00000000-0000-4000-8000-000000009702');

insert into public.departments (name) values ('Force used section'), ('Force unused section');
insert into public.ranks (name, code, sort_order) values ('Force used rank', 'FUR', 9701);
insert into public.unit_stations (name) values ('Force unused station');

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on, department_id, rank_id)
select '00000000-0000-4000-8000-000000009711', '9-70001', 'Forced', 'Officer', 'forced.officer@example.test', '2020-01-01',
  (select id from public.departments where name = 'Force used section'), (select id from public.ranks where code = 'FUR');
insert into public.service_history (id, employee_id, department_id, rank_id, started_on)
select '00000000-0000-4000-8000-000000009712', '00000000-0000-4000-8000-000000009711',
  (select id from public.departments where name = 'Force used section'), (select id from public.ranks where code = 'FUR'), '2020-01-01';
insert into public.performance_ratings (employee_id, rating, review_period_starts_on, review_period_ends_on, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000009711', 4, '2025-01-01', '2025-12-31', '00000000-0000-4000-8000-000000009702', '00000000-0000-4000-8000-000000009702');
insert into public.promotion_criteria (id, target_rank_id, minimum_years_of_service, created_by_user_id, updated_by_user_id)
select '00000000-0000-4000-8000-000000009713', id, 2, '00000000-0000-4000-8000-000000009702', '00000000-0000-4000-8000-000000009702'
from public.ranks where code = 'FUR';

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Options (administrator)
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009702';
select extensions.throws_ok(
  $$select public.delete_record('department', (select id::text from public.departments where name = 'Force unused section'))$$,
  '42501', 'Administrator access is required.', 'HR cannot delete units / sections');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009701';
select extensions.lives_ok(
  $$select public.delete_record('department', (select id::text from public.departments where name = 'Force unused section'))$$,
  'An unused unit / section is deleted');
select extensions.lives_ok(
  $$select public.delete_record('unit_station', (select id::text from public.unit_stations where name = 'Force unused station'))$$,
  'An unused unit / station is deleted');

select extensions.ok(
  (public.get_deletion_impact('department', (select id::text from public.departments where name = 'Force used section')) ->> 'canForce')::boolean,
  'A unit / section in use can be force deleted');
select extensions.throws_like(
  $$select public.delete_record('department', (select id::text from public.departments where name = 'Force used section'))$$,
  '%cannot be deleted. It is still used by%', 'Without force, a unit / section in use is not deleted');
select extensions.lives_ok(
  $$select public.delete_record('department', (select id::text from public.departments where name = 'Force used section'), true)$$,
  'A unit / section in use is force deleted');
select extensions.lives_ok(
  $$select public.delete_record('rank', (select id::text from public.ranks where code = 'FUR'), true)$$,
  'A rank in use is force deleted');

set local role postgres;
select extensions.is((select count(*) from public.departments where name in ('Force used section', 'Force unused section')), 0::bigint, 'Both units / sections are gone');
select extensions.is((select count(*) from public.employees where id = '00000000-0000-4000-8000-000000009711'), 1::bigint, 'The personnel record that used them is kept');
select extensions.ok(
  (select department_id is null and rank_id is null from public.employees where id = '00000000-0000-4000-8000-000000009711'),
  'The personnel record is unlinked from the deleted unit / section and rank');
select extensions.ok(
  (select department_id is null and rank_id is null from public.service_history where id = '00000000-0000-4000-8000-000000009712'),
  'Service history is unlinked from the deleted unit / section and rank');
select extensions.is((select count(*) from public.promotion_criteria where id = '00000000-0000-4000-8000-000000009713'), 0::bigint, 'Promotion criteria for the deleted rank are removed');
select extensions.ok(exists (
  select 1 from public.audit_logs where entity_type = 'ranks' and action = 'delete' and (metadata ->> 'forced')::boolean
), 'A forced delete is audited as forced');

-- ---------------------------------------------------------------------------
-- Personnel entries and personnel records (HR)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009702';
select extensions.lives_ok(
  $$select public.delete_record('service_history', '00000000-0000-4000-8000-000000009712')$$,
  'HR can delete a service history entry');
select extensions.is(
  (public.get_deletion_impact('employee', '00000000-0000-4000-8000-000000009711') ->> 'canDelete')::boolean, false,
  'A personnel record with a performance rating is blocked');
select extensions.ok(
  (public.get_deletion_impact('employee', '00000000-0000-4000-8000-000000009711') ->> 'canForce')::boolean,
  'A blocked personnel record can be force deleted');
select extensions.throws_ok(
  $$select public.delete_record('employee', '00000000-0000-4000-8000-000000009711')$$,
  'P0001', null, 'Without force, the blocked personnel record is not deleted');
select extensions.lives_ok(
  $$select public.delete_record('employee', '00000000-0000-4000-8000-000000009711', true)$$,
  'HR can force delete a personnel record');

set local role postgres;
select extensions.is(
  (select count(*) from public.employees where id = '00000000-0000-4000-8000-000000009711')
    + (select count(*) from public.performance_ratings where employee_id = '00000000-0000-4000-8000-000000009711')
    + (select count(*) from public.service_history where employee_id = '00000000-0000-4000-8000-000000009711')
    + (select count(*) from public.employee_record_history where employee_id = '00000000-0000-4000-8000-000000009711'),
  0::bigint,
  'The personnel record and everything that depended on it are removed');

-- ---------------------------------------------------------------------------
-- Accounts and notifications cannot be forced
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009701';
select extensions.is(
  (public.get_deletion_impact('managed_user', '00000000-0000-4000-8000-000000009701') ->> 'canForce')::boolean, false,
  'Your own account cannot be force deleted');
select extensions.throws_ok(
  $$select public.delete_record('managed_user', '00000000-0000-4000-8000-000000009702', true)$$,
  '22023', 'This record cannot be deleted here.', 'Accounts are not deleted through delete_record');

set local role anon;
select extensions.throws_ok(
  $$select public.delete_record('department', '1', true)$$,
  '42501', null, 'Anonymous callers cannot force delete');

select * from extensions.finish();

rollback;
