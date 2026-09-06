begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(20);

select extensions.has_table('public', 'deployments', 'Deployments table exists');
select extensions.has_table('public', 'deployment_history', 'Deployment history table exists');
select extensions.has_function('public', 'create_deployment', array['uuid', 'text', 'text', 'text', 'text', 'date', 'date', 'text', 'text'], 'Deployment creation RPC exists');
select extensions.has_function('public', 'update_deployment', array['uuid', 'timestamp with time zone', 'text', 'text', 'text', 'text', 'date', 'date', 'text', 'text'], 'Deployment update RPC exists');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.deployments')), false), 'Deployments use RLS');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.deployment_history')), false), 'Deployment history uses RLS');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000601', 'authenticated', 'authenticated', 'deployment-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000602', 'authenticated', 'authenticated', 'deployment-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000603', 'authenticated', 'authenticated', 'deployment-other@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000000601'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000000601'::uuid,
  '00000000-0000-4000-8000-000000000602'::uuid,
  '00000000-0000-4000-8000-000000000603'::uuid
);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000602', 'DEP-001', 'Deployment', 'Employee', 'deployment-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000603', 'DEP-002', 'Other', 'Employee', 'deployment-other@example.test', '2024-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';

select extensions.lives_ok(
  $$select public.create_deployment(
    '00000000-0000-4000-8000-000000000701'::uuid, 'Central station', null, null,
    'Patrol officer', '2026-09-01', null, 'active', 'Primary assignment'
  )$$,
  'HR creates an active deployment'
);
select extensions.lives_ok(
  $$select public.create_deployment(
    '00000000-0000-4000-8000-000000000701'::uuid, null, 'Operations', 'Community project',
    'Project liaison', '2026-09-01', null, 'rejected', null
  )$$,
  'HR can create an overlapping rejected deployment'
);
select extensions.is((select count(*) from public.deployments where employee_id = '00000000-0000-4000-8000-000000000701'::uuid), 2::bigint, 'Concurrent assignments are retained');
select extensions.throws_ok(
  $$select public.create_deployment(
    '00000000-0000-4000-8000-000000000701'::uuid, 'Central station', null, null,
    'Patrol officer', '2026-09-01', null, 'planned', null
  )$$,
  '22023', 'Deployment status is invalid.', 'Retired deployment statuses are rejected'
);

set local role postgres;
select set_config('test.deployment_id', (select id::text from public.deployments where assignment_role = 'Patrol officer'), true);
select set_config('test.expected_updated_at', (select updated_at::text from public.deployments where id::text = current_setting('test.deployment_id')), true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000602';
select extensions.is((select count(*) from public.deployments), 2::bigint, 'Employee can read only their deployments');
select extensions.is((select count(*) from public.deployment_history), 2::bigint, 'Employee can read only their deployment history');
select extensions.throws_ok(
  $$select public.create_deployment(
    '00000000-0000-4000-8000-000000000701'::uuid, 'Central station', null, null,
    'Unauthorised edit', '2026-09-01', null, 'active', null
  )$$,
  '42501', null, 'Employee cannot create a deployment'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000603';
select extensions.is((select count(*) from public.deployments), 0::bigint, 'Other employees cannot read another employee deployments');
select extensions.is((select count(*) from public.deployment_history), 0::bigint, 'Other employees cannot read another employee deployment history');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
select extensions.lives_ok(
  $$select public.update_deployment(
    current_setting('test.deployment_id')::uuid, current_setting('test.expected_updated_at')::timestamptz,
    'Central station', null, null, 'Patrol officer', '2026-09-01', '2026-09-30', 'rejected', 'Assignment rejected'
  )$$,
  'HR can reject a deployment'
);
select extensions.is((select status from public.deployments where id::text = current_setting('test.deployment_id')), 'rejected', 'Rejection updates the deployment status');
select extensions.is((select count(*) from public.deployment_history where deployment_id::text = current_setting('test.deployment_id')), 2::bigint, 'Update appends immutable history');
set local role postgres;
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'deployments' and entity_id = current_setting('test.deployment_id') and action = 'status_changed'), 'Status transition is audited');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
select extensions.throws_ok(
  $$select public.update_deployment(
    current_setting('test.deployment_id')::uuid, current_setting('test.expected_updated_at')::timestamptz,
    'Central station', null, null, 'Patrol officer', '2026-09-01', '2026-09-30', 'rejected', 'Stale update'
  )$$,
  'P0001', null, 'Stale update is refused'
);

select * from extensions.finish();

rollback;
