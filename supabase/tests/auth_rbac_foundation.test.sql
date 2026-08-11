begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(18);

select extensions.has_table('public', 'profiles', 'profiles table exists');
select extensions.has_table('public', 'user_roles', 'user_roles table exists');
select extensions.has_table('public', 'departments', 'departments table exists');
select extensions.has_table('public', 'positions', 'positions table exists');
select extensions.has_table('public', 'audit_logs', 'audit_logs table exists');

set local role anon;
select extensions.is(
  (select count(*) from public.profiles),
  0::bigint,
  'Anonymous users cannot read profiles'
);
reset role;
set local role postgres;

set local role anon;
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('private-documents', 'unauthorized.txt')$$,
  '42501',
  null,
  'Anonymous users cannot upload private documents'
);
reset role;
set local role postgres;

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

insert into public.departments (name) values ('Fixture Department');

set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'Applicant reads only their own profile'
);
select extensions.is(
  (select count(*) from public.user_roles),
  1::bigint,
  'Applicant reads only their own role'
);
update public.profiles
set full_name = 'Unauthorized'
where id = '00000000-0000-0000-0000-000000000003'::uuid;
set local role postgres;
select extensions.is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000003'::uuid),
  null::text,
  'Applicant cannot update an official profile'
);
set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select extensions.is(
  (select count(*) from public.profiles where email like '%.fixture@example.com'),
  5::bigint,
  'HR can read all foundation profiles'
);
update public.user_roles
set role = 'management'::public.app_role
where user_id = '00000000-0000-0000-0000-000000000003'::uuid;
set local role postgres;
select extensions.is(
  (select role::text from public.user_roles where user_id = '00000000-0000-0000-0000-000000000003'::uuid),
  'applicant',
  'HR cannot assign roles'
);
set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
select extensions.is(
  (select count(*) from public.departments),
  1::bigint,
  'Management can read reference data'
);
update public.departments
set name = 'Unauthorized'
where name = 'Fixture Department';
set local role postgres;
select extensions.is(
  (select name from public.departments where name = 'Fixture Department'),
  'Fixture Department',
  'Management cannot mutate reference data'
);
set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select extensions.lives_ok(
  $$insert into public.departments (name) values ('Administrator Department')$$,
  'System Administrator can create a department'
);
select extensions.lives_ok(
  $$update public.user_roles set role = 'employee'::public.app_role where user_id = '00000000-0000-0000-0000-000000000003'::uuid$$,
  'System Administrator can change a role'
);
select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where (
      entity_type = 'user_roles'
      and entity_id between '00000000-0000-0000-0000-000000000001'
        and '00000000-0000-0000-0000-000000000005'
    )
    or (
      entity_type = 'departments'
      and metadata ->> 'name' in ('Fixture Department', 'Administrator Department')
    )
  ),
  13::bigint,
  'Fixture privileged changes create audit log entries'
);
select extensions.is_empty(
  $$select id from storage.objects where bucket_id = 'private-documents'$$,
  'Private document bucket exposes no existing objects by default'
);

select * from extensions.finish();

rollback;
