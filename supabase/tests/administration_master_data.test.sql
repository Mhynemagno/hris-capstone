begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(25);

select extensions.has_table(
  'public',
  'organization_settings',
  'Organization settings has a dedicated table'
);
select extensions.has_column(
  'public', 'positions', 'code', 'Positions support a unique optional code'
);
select extensions.has_column(
  'public', 'positions', 'description', 'Positions support an optional description'
);
select extensions.has_function(
  'private',
  'update_managed_user',
  array['uuid', 'public.app_role', 'boolean'],
  'Role and activation changes use a private workflow'
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

insert into public.organization_settings (
  organization_name, support_email, default_timezone
) values ('Fixture HRIS', 'support@example.com', 'Asia/Ulaanbaatar');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

update public.user_roles
set role = 'employee'::public.app_role
where user_id = '00000000-0000-0000-0000-000000000003'::uuid;

set local role postgres;
select extensions.is(
  (select role::text from public.user_roles where user_id = '00000000-0000-0000-0000-000000000003'::uuid),
  'applicant',
  'Administrator cannot bypass the role workflow with a direct update'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select extensions.lives_ok(
  $$select public.update_managed_user(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'employee'::public.app_role,
    true
  )$$,
  'Administrator can promote an applicant through the workflow'
);

set local role postgres;
select extensions.is(
  (select role::text from public.user_roles where user_id = '00000000-0000-0000-0000-000000000003'::uuid),
  'employee',
  'Workflow changes the applicant role'
);
select extensions.cmp_ok(
  (
    select count(*)
    from public.audit_logs
    where actor_user_id = '00000000-0000-0000-0000-000000000001'::uuid
      and entity_type = 'user_roles'
      and entity_id = '00000000-0000-0000-0000-000000000003'
  ),
  '>',
  0::bigint,
  'Workflow role assignment is audited with the administrator actor'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.profiles
set is_active = false
where id = '00000000-0000-0000-0000-000000000004'::uuid;

set local role postgres;
select extensions.is(
  (select is_active from public.profiles where id = '00000000-0000-0000-0000-000000000004'::uuid),
  true,
  'Administrator cannot bypass the activation workflow with a direct update'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select extensions.lives_ok(
  $$select public.update_managed_user(
    '00000000-0000-0000-0000-000000000004'::uuid,
    'employee'::public.app_role,
    false
  )$$,
  'Administrator can deactivate another account through the workflow'
);

set local role postgres;
select extensions.is(
  (select is_active from public.profiles where id = '00000000-0000-0000-0000-000000000004'::uuid),
  false,
  'Workflow changes the target activation state'
);
select extensions.cmp_ok(
  (
    select count(*)
    from public.audit_logs
    where actor_user_id = '00000000-0000-0000-0000-000000000001'::uuid
      and entity_type = 'profiles'
      and entity_id = '00000000-0000-0000-0000-000000000004'
      and action = 'activation_changed'
  ),
  '>',
  0::bigint,
  'Workflow activation change is audited with the administrator actor'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select extensions.throws_ok(
  $$select public.update_managed_user(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'applicant'::public.app_role,
    true
  )$$,
  '42501',
  'Administrator access is required.',
  'HR cannot invoke the role and activation workflow'
);
select extensions.is(
  (select count(*) from public.organization_settings),
  0::bigint,
  'HR cannot read organization settings'
);
select extensions.is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'HR cannot read audit logs'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select extensions.is(
  (select count(*) from public.organization_settings),
  1::bigint,
  'Administrator can read organization settings'
);

select extensions.lives_ok(
  $$insert into public.departments (name) values ('Administration UI Test Department')$$,
  'Administrator can create departments'
);
select extensions.lives_ok(
  $$insert into public.positions (department_id, title) values ((select id from public.departments where name = 'Administration UI Test Department'), 'Administration UI Test Position')$$,
  'Administrator can create department-assigned positions'
);
select extensions.lives_ok(
  $$update public.departments set is_active = false where name = 'Administration UI Test Department'$$,
  'Administrator can deactivate departments'
);
select extensions.lives_ok(
  $$update public.positions set is_active = false where title = 'Administration UI Test Position'$$,
  'Administrator can deactivate positions'
);
select extensions.cmp_ok(
  (select count(*) from public.audit_logs where entity_type in ('departments', 'positions')),
  '>', 0::bigint,
  'Reference-data changes are audited'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select extensions.throws_ok(
  $$insert into public.departments (name) values ('Denied HR Department')$$,
  '42501', null,
  'HR cannot create departments'
);
update public.positions
set title = 'Denied Update'
where title = 'Administration UI Test Position';

set local role postgres;
select extensions.is(
  (select title from public.positions where title = 'Administration UI Test Position'),
  'Administration UI Test Position',
  'HR cannot update positions'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select extensions.throws_ok(
  $$delete from public.audit_logs where id = (select min(id) from public.audit_logs)$$,
  '42501', null,
  'Administrators cannot delete audit logs'
);

set local role postgres;
update public.profiles
set is_active = false
where id = '00000000-0000-0000-0000-000000000001'::uuid;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select extensions.throws_ok(
  $$select public.update_managed_user(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'applicant'::public.app_role,
    true
  )$$,
  '42501',
  'Administrator access is required.',
  'An inactive administrator cannot invoke the workflow'
);

select * from extensions.finish();

rollback;
