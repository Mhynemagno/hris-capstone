begin;

set local role postgres;
set local search_path = extensions, public;
select extensions.plan(11);

select extensions.has_table('public', 'deployment_groups', 'Deployment headers support multiple assignments');
select extensions.has_table('public', 'deployment_assignments', 'Per-employee deployment assignments exist');
select extensions.has_column('public', 'deployment_assignments', 'task', 'Assignments retain their deployment task');
select extensions.has_function('public', 'create_deployment_group', array['text', 'text', 'date', 'date', 'text', 'text', 'jsonb'], 'HR group creation RPC exists');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.deployment_groups')), false), 'Deployment groups use RLS');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.deployment_assignments')), false), 'Deployment assignments use RLS');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000751', 'authenticated', 'authenticated', 'deployment-group-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000752', 'authenticated', 'authenticated', 'deployment-group-employee@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000000751'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end
where user_id in ('00000000-0000-4000-8000-000000000751'::uuid, '00000000-0000-4000-8000-000000000752'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000000761', '00000000-0000-4000-8000-000000000752', 'DGP-001', 'Group', 'Employee', 'deployment-group-employee@example.test', '2024-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000751';
select extensions.throws_ok(
  $$select public.create_deployment_group('San Juan', null, '2026-10-22', null, 'Public Assembly', 'Flood / Emergency', '[{"employeeId":"00000000-0000-4000-8000-000000000761","task":"Deployed"}]'::jsonb)$$,
  '22023', 'Event / operation does not match the deployment type.', 'A public assembly cannot use a disaster event'
);
select extensions.lives_ok(
  $$select public.create_deployment_group('San Juan', null, '2026-10-22', null, 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000000761","task":"Reserve/Standby"}]'::jsonb)$$,
  'HR creates a grouped deployment'
);
select extensions.is((select count(*) from public.deployment_assignments), 1::bigint, 'Group creation writes one assignment per selected employee');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000752';
select extensions.is((select count(*) from public.deployment_groups), 1::bigint, 'Assigned employee can read their deployment header');
select extensions.throws_ok(
  $$select public.create_deployment_group('San Juan', null, '2026-10-22', null, 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000000761","task":"Deployed"},{"employeeId":"00000000-0000-4000-8000-000000000761","task":"Reserve/Standby"}]'::jsonb)$$,
  '42501', null, 'Non-HR employees cannot create deployment groups'
);

select * from extensions.finish();
rollback;
