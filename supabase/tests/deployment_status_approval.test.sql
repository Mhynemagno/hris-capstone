begin;

set local role postgres;
set local search_path = extensions, public;
select extensions.plan(34);

select extensions.has_column('public', 'deployments', 'task', 'Deployments store their task');
select extensions.has_column('public', 'deployments', 'deployment_group_id', 'Deployments keep their group header');
select extensions.has_column('public', 'deployments', 'proposed_status', 'Deployments keep the employee-proposed status');
select extensions.has_function('public', 'update_deployment_details', array['uuid', 'timestamp with time zone', 'text', 'date', 'date', 'text', 'text', 'text'], 'HR detail update RPC exists');
select extensions.has_function('public', 'cancel_deployment', array['uuid', 'timestamp with time zone'], 'HR cancel RPC exists');
select extensions.has_function('public', 'propose_deployment_status', array['uuid', 'text'], 'Employee status proposal RPC exists');
select extensions.has_function('public', 'review_deployment_status', array['uuid', 'boolean'], 'HR status review RPC exists');
select extensions.ok(not has_function_privilege('authenticated', 'public.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text, text, text)', 'execute'), 'Signed-in users can no longer call the status-writing update RPC');
select extensions.ok(not has_function_privilege('authenticated', 'public.create_deployment(uuid, text, text, text, text, date, date, text, text, text, text)', 'execute'), 'Signed-in users can no longer call the status-writing create RPC');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000003001', 'authenticated', 'authenticated', 'approval-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003002', 'authenticated', 'authenticated', 'approval-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003003', 'authenticated', 'authenticated', 'approval-other@example.test', now(), now());

update public.user_roles
set role = case user_id when '00000000-0000-4000-8000-000000003001'::uuid then 'hr_personnel'::public.app_role else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000003001'::uuid, '00000000-0000-4000-8000-000000003002'::uuid, '00000000-0000-4000-8000-000000003003'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000003011', '00000000-0000-4000-8000-000000003002', 'APR-001', 'Approval', 'Employee', 'approval-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000003012', '00000000-0000-4000-8000-000000003003', 'APR-002', 'Leave', 'Employee', 'approval-other@example.test', '2024-01-01');

insert into public.leave_types (id, name) values ('00000000-0000-4000-8000-000000003021', 'Approval test leave');
set local session_replication_role = replica;
insert into public.leave_requests (id, employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on, status, decided_by_user_id, decided_at)
values ('00000000-0000-4000-8000-000000003031', '00000000-0000-4000-8000-000000003012', '00000000-0000-4000-8000-000000003003', '00000000-0000-4000-8000-000000003021', 'Approval test leave', '2099-06-01', '2099-06-10', 'approved', '00000000-0000-4000-8000-000000003001', now());
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003001';

select extensions.throws_ok(
  $$select public.create_deployment_group('Plaza', null, '2099-06-05', null, 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000003012","task":"Deployed"}]'::jsonb)$$,
  '22023', 'An employee on approved leave cannot be deployed.', 'An employee on approved leave is refused'
);
select extensions.throws_ok(
  $$select public.create_deployment_group('Plaza', null, '2099-06-05', null, 'Public Assembly', 'Fiesta / Major Event', '[{"employeeId":"00000000-0000-4000-8000-000000003011","task":"Deployed"}]'::jsonb)$$,
  '22023', 'Event / operation does not match the deployment type.', 'Public Assembly only allows Rally'
);
select extensions.lives_ok(
  $$select public.create_deployment_group('Plaza', null, '2099-06-05', '2099-06-07', 'Public Assembly', 'Rally', '[{"employeeId":"00000000-0000-4000-8000-000000003011","task":"Reserve/Standby"}]'::jsonb)$$,
  'HR creates a grouped deployment'
);

set local role postgres;
select set_config('test.deployment_id', (select id::text from public.deployments where employee_id = '00000000-0000-4000-8000-000000003011'), true);
select extensions.ok(
  (select task = 'Reserve/Standby' and notes is null and deployment_group_id is not null from public.deployments where id::text = current_setting('test.deployment_id')),
  'Grouped creation stores the task and header without a generated note'
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.update_deployment_details(current_setting('test.deployment_id')::uuid,
      (select updated_at from public.deployments where id::text = current_setting('test.deployment_id')),
      'Plaza', '2099-06-05', '2099-06-07', 'Public Assembly', 'Flood / Emergency', 'Reserve/Standby')$$,
  '22023', 'Event / operation does not match the deployment type.', 'An event outside the type is refused on update'
);
select extensions.lives_ok(
  $$select public.update_deployment_details(current_setting('test.deployment_id')::uuid,
      (select updated_at from public.deployments where id::text = current_setting('test.deployment_id')),
      'Plaza North', '2099-06-05', null, 'Special Event', 'Government Event', 'Reserve/Standby')$$,
  'HR edits the deployment details'
);
select extensions.ok(
  (select task = 'Reserve/Standby' and location = 'Plaza North' and ends_on is null and status = 'scheduled' from public.deployments where id::text = current_setting('test.deployment_id')),
  'The task survives an edit and the status is untouched'
);
select extensions.throws_ok(
  $$select public.review_deployment_status(current_setting('test.deployment_id')::uuid, true)$$,
  '22023', 'There is no status update waiting for approval.', 'HR cannot set a status without an employee proposal'
);
select extensions.throws_ok(
  $$select public.update_deployment(current_setting('test.deployment_id')::uuid,
      (select updated_at from public.deployments where id::text = current_setting('test.deployment_id')),
      'Plaza North', null, null, 'Deployed', '2099-06-05', null, 'completed', null, 'Special Event', 'Government Event')$$,
  '42501', null, 'HR cannot set Completed through the legacy update RPC'
);
select extensions.throws_ok(
  $$select public.propose_deployment_status(current_setting('test.deployment_id')::uuid, 'ongoing')$$,
  '42501', 'Only the assigned employee can update this deployment status.', 'HR cannot propose a status'
);

-- The deployed employee proposes.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003003';
select extensions.throws_ok(
  $$select public.propose_deployment_status(current_setting('test.deployment_id')::uuid, 'ongoing')$$,
  '42501', null, 'Another employee cannot propose a status'
);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003002';
select extensions.throws_ok(
  $$select public.propose_deployment_status(current_setting('test.deployment_id')::uuid, 'completed')$$,
  '22023', 'Submit a report or proof of attendance before marking the deployment as completed.', 'Completed needs a submitted report'
);
select extensions.throws_ok(
  $$select public.propose_deployment_status(current_setting('test.deployment_id')::uuid, 'cancelled')$$,
  '22023', 'Choose Ongoing or Completed.', 'Employees cannot propose Cancelled'
);
select extensions.lives_ok(
  $$select public.propose_deployment_status(current_setting('test.deployment_id')::uuid, 'ongoing')$$,
  'The employee proposes Ongoing'
);
select extensions.ok(
  (select proposed_status = 'ongoing' and status = 'scheduled' from public.deployments where id::text = current_setting('test.deployment_id')),
  'The proposal waits for approval'
);
select extensions.is(
  (select review_status from public.deployment_assignments where employee_id = '00000000-0000-4000-8000-000000003011'),
  'for_approval', 'The grouped assignment shows the proposal'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003001';
select extensions.lives_ok($$select public.review_deployment_status(current_setting('test.deployment_id')::uuid, true)$$, 'HR approves the proposal');
select extensions.ok(
  (select status = 'ongoing' and proposed_status is null and status_reviewed_by_user_id = '00000000-0000-4000-8000-000000003001' from public.deployments where id::text = current_setting('test.deployment_id')),
  'Approval applies the proposed status'
);

set local role postgres;
select extensions.ok(
  exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000003002' and title = 'Deployment status approved'),
  'The employee is notified of the approval'
);
insert into public.deployment_reports (deployment_id, object_path, file_name, mime_type, size_bytes, submitted_by_user_id)
values (current_setting('test.deployment_id')::uuid, 'deployments/' || current_setting('test.deployment_id') || '/proof.pdf', 'proof.pdf', 'application/pdf', 100, '00000000-0000-4000-8000-000000003002');
set local role authenticated;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003002';
select extensions.lives_ok($$select public.propose_deployment_status(current_setting('test.deployment_id')::uuid, 'completed')$$, 'With proof, the employee proposes Completed');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003001';
select extensions.lives_ok($$select public.review_deployment_status(current_setting('test.deployment_id')::uuid, false)$$, 'HR rejects the proposal');
select extensions.ok(
  (select status = 'ongoing' and proposed_status is null from public.deployments where id::text = current_setting('test.deployment_id')),
  'Rejection keeps the current status'
);

select extensions.lives_ok(
  $$select public.cancel_deployment(current_setting('test.deployment_id')::uuid, (select updated_at from public.deployments where id::text = current_setting('test.deployment_id')))$$,
  'HR cancels the deployment'
);
select extensions.is((select status from public.deployments where id::text = current_setting('test.deployment_id')), 'cancelled', 'Cancelling sets the status');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003002';
select extensions.throws_ok(
  $$select public.propose_deployment_status(current_setting('test.deployment_id')::uuid, 'completed')$$,
  '22023', 'This deployment is already closed.', 'A cancelled deployment cannot be proposed as completed'
);

select * from extensions.finish();
rollback;
