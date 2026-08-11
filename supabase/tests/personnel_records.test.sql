begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(24);

select extensions.has_table('public', 'employees', 'Employee records table exists');
select extensions.has_table('public', 'service_history', 'Service history table exists');
select extensions.has_table('public', 'qualifications', 'Qualifications table exists');
select extensions.has_table('public', 'certifications', 'Certifications table exists');
select extensions.has_table('public', 'training_records', 'Training records table exists');
select extensions.has_table('public', 'employee_record_history', 'Personnel history table exists');
select extensions.has_column('public', 'employees', 'profile_id', 'Employees can link to an account');
select extensions.is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
  ),
  1::bigint,
  'Employee reads use one combined authenticated policy'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.fixture@example.com', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'hr.fixture@example.com', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'applicant.fixture@example.com', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'employee.fixture@example.com', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'management.fixture@example.com', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-0000-0000-000000000001'::uuid then 'system_administrator'::public.app_role
  when '00000000-0000-0000-0000-000000000002'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-0000-0000-000000000003'::uuid then 'applicant'::public.app_role
  when '00000000-0000-0000-0000-000000000004'::uuid then 'employee'::public.app_role
  when '00000000-0000-0000-0000-000000000005'::uuid then 'management'::public.app_role
end
where user_id between '00000000-0000-0000-0000-000000000001'::uuid
  and '00000000-0000-0000-0000-000000000005'::uuid;

insert into public.departments (name)
values ('Personnel fixture department');

insert into public.positions (department_id, title)
select id, 'Personnel fixture position'
from public.departments
where name = 'Personnel fixture department';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

select extensions.lives_ok(
  $$insert into public.employees (
    id, profile_id, employee_number, first_name, last_name, personal_email,
    department_id, position_id, employment_status, employment_started_on
  )
  select
    '00000000-0000-0000-0000-000000000010'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    'EMP-0001',
    'Erdene',
    'Bat',
    'employee.fixture@example.com',
    department.id,
    position.id,
    'active',
    '2024-01-01'::date
  from public.departments department
  join public.positions position on position.department_id = department.id
  where department.name = 'Personnel fixture department'$$,
  'HR can create an official employee record'
);

select extensions.cmp_ok(
  (select count(*) from public.employee_record_history where employee_id = '00000000-0000-0000-0000-000000000010'::uuid and action = 'insert'),
  '>',
  0::bigint,
  'Creating an employee records immutable history'
);

select extensions.lives_ok(
  $$insert into public.service_history (employee_id, started_on, employment_title)
    values ('00000000-0000-0000-0000-000000000010'::uuid, '2024-01-01', 'HR officer')$$,
  'HR can add service history'
);

select extensions.lives_ok(
  $$update public.employees
      set phone = '+976-99000000'
    where id = '00000000-0000-0000-0000-000000000010'::uuid$$,
  'HR can update official employee fields'
);

select extensions.cmp_ok(
  (select count(*) from public.employee_record_history where employee_id = '00000000-0000-0000-0000-000000000010'::uuid and action = 'update'),
  '>',
  0::bigint,
  'Updating an employee records immutable history'
);

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_status, employment_started_on)
values ('00000000-0000-0000-0000-000000000011', 'EMP-0002', 'Other', 'Employee', 'other.fixture@example.com', 'active', '2024-01-01');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

select extensions.is(
  (select count(*) from public.employees),
  1::bigint,
  'Employee can select only their linked official record'
);

select extensions.is(
  (select count(*) from public.service_history),
  1::bigint,
  'Employee can select only service history belonging to their record'
);

update public.employees
set phone = '+976-99111111'
where id = '00000000-0000-0000-0000-000000000010'::uuid;

set local role postgres;
select extensions.is(
  (select phone from public.employees where id = '00000000-0000-0000-0000-000000000010'::uuid),
  '+976-99000000',
  'Employee cannot update official employee fields'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

select extensions.throws_ok(
  $$insert into public.qualifications (employee_id, name, institution, awarded_on)
    values ('00000000-0000-0000-0000-000000000010'::uuid, 'MBA', 'Fixture University', '2024-01-01')$$,
  '42501',
  null,
  'Employee cannot add official qualifications'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';

select extensions.is(
  (select count(*) from public.employees),
  0::bigint,
  'Management cannot read personnel records in this branch'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

select extensions.throws_ok(
  $$insert into public.employee_record_history (employee_id, record_type, action, previous_data, next_data)
    values ('00000000-0000-0000-0000-000000000010'::uuid, 'employees', 'insert', '{}'::jsonb, '{}'::jsonb)$$,
  '42501',
  null,
  'HR cannot forge personnel history'
);

select extensions.throws_ok(
  $$update public.employee_record_history
      set action = 'update'
    where employee_id = '00000000-0000-0000-0000-000000000010'::uuid$$,
  '42501',
  null,
  'HR cannot alter personnel history'
);

select extensions.throws_ok(
  $$insert into public.employees (employee_number, first_name, last_name, personal_email, employment_status, employment_started_on)
    values ('EMP-0001', 'Duplicate', 'Number', 'duplicate.fixture@example.com', 'active', '2024-01-01')$$,
  '23505',
  null,
  'Employee number is unique'
);

select extensions.throws_ok(
  $$insert into public.service_history (employee_id, started_on, ended_on)
    values ('00000000-0000-0000-0000-000000000010'::uuid, '2026-02-01', '2026-01-01')$$,
  '23514',
  null,
  'Service history rejects an inverted date range'
);

select extensions.throws_ok(
  $$insert into public.certifications (employee_id, name, issuer, issued_on, expires_on)
    values ('00000000-0000-0000-0000-000000000010'::uuid, 'First aid', 'Red Cross', '2026-02-01', '2026-01-01')$$,
  '23514',
  null,
  'Certification rejects an inverted date range'
);

select extensions.throws_ok(
  $$insert into public.training_records (employee_id, course_name, provider, completed_on, hours)
    values ('00000000-0000-0000-0000-000000000010'::uuid, 'Safety', 'Academy', '2026-01-01', -1)$$,
  '23514',
  null,
  'Training rejects negative hours'
);

select * from extensions.finish();

rollback;
