begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(12);

select extensions.has_table('public', 'profile_change_requests', 'Profile change request headers exist');
select extensions.has_table('public', 'profile_change_request_changes', 'Proposed changes exist');
select extensions.has_table('public', 'profile_change_request_documents', 'Request document metadata exists');
select extensions.has_table('public', 'profile_change_request_history', 'Request history exists');
select extensions.has_function('public', 'submit_profile_change_request', array['uuid', 'text', 'jsonb', 'jsonb'], 'Submission RPC exists');
select extensions.has_function('public', 'cancel_profile_change_request', array['uuid'], 'Cancellation RPC exists');
select extensions.has_function('public', 'decide_profile_change_request', array['uuid', 'text', 'text'], 'Decision RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'profile-admin@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'profile-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'profile-other@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000000101'::uuid then 'system_administrator'::public.app_role
  when '00000000-0000-4000-8000-000000000102'::uuid then 'employee'::public.app_role
  when '00000000-0000-4000-8000-000000000103'::uuid then 'employee'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000000101'::uuid,
  '00000000-0000-4000-8000-000000000102'::uuid,
  '00000000-0000-4000-8000-000000000103'::uuid
);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000102', 'PROF-001', 'Profile', 'Employee', 'profile-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000103', 'PROF-002', 'Other', 'Employee', 'profile-other@example.test', '2024-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';

select extensions.lives_ok(
  $$select public.submit_profile_change_request(
    '00000000-0000-4000-8000-000000000301'::uuid,
    'Updated mobile number',
    '[{"kind":"contact","field":"phone","originalValue":null,"requestedValue":"+976 99112233"}]'::jsonb,
    '[]'::jsonb
  )$$,
  'Employee submits a pending contact change without writing official data'
);
select extensions.is(
  (select phone from public.employees where id = '00000000-0000-4000-8000-000000000201'::uuid),
  null::text,
  'Submission does not update the official employee record'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
select extensions.lives_ok(
  $$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000301'::uuid, 'approved', null)$$,
  'Administrator approves a pending request'
);

set local role postgres;
select extensions.is(
  (select phone from public.employees where id = '00000000-0000-4000-8000-000000000201'::uuid),
  '+976 99112233',
  'Approval updates official contact data'
);
select extensions.ok(
  exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000000102'::uuid and type = 'profile_change_decision'),
  'Approval creates an employee notification'
);

select * from extensions.finish();
rollback;
