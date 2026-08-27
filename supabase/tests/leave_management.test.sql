begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(11);

select extensions.has_table('public', 'leave_types', 'Leave types table exists');
select extensions.has_table('public', 'leave_requests', 'Leave requests table exists');
select extensions.has_table('public', 'leave_request_attachments', 'Leave attachments table exists');
select extensions.has_table('public', 'leave_request_history', 'Leave history table exists');
select extensions.has_function('public', 'submit_leave_request', array['uuid', 'uuid', 'date', 'date', 'text', 'jsonb'], 'Leave submission RPC exists');
select extensions.has_function('public', 'cancel_leave_request', array['uuid'], 'Leave cancellation RPC exists');
select extensions.has_function('public', 'decide_leave_request', array['uuid', 'text', 'text'], 'Leave decision RPC exists');
select extensions.has_function('public', 'create_leave_type', array['text', 'text', 'boolean'], 'Leave type creation RPC exists');
select extensions.has_function('public', 'update_leave_type', array['uuid', 'text', 'text', 'boolean', 'boolean'], 'Leave type update RPC exists');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.leave_requests')), false), 'Leave requests use RLS');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000701', 'authenticated', 'authenticated', 'leave-employee@example.test', now(), now());

update public.user_roles
set role = 'employee'::public.app_role
where user_id = '00000000-0000-4000-8000-000000000701'::uuid;

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000701', 'LEV-001', 'Leave', 'Employee', 'leave-employee@example.test', '2024-01-01');

insert into public.leave_types (id, name, requires_attachment, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000000721', 'Medical leave test', true, '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000701');

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000000731',
  'private-documents',
  'leave-requests/00000000-0000-4000-8000-000000000701/00000000-0000-4000-8000-000000000741/evidence.pdf',
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000701',
  '{"mimetype":"application/pdf","size":1024}'::jsonb
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000701';

select extensions.lives_ok(
  $$select public.submit_leave_request(
    '00000000-0000-4000-8000-000000000741'::uuid,
    '00000000-0000-4000-8000-000000000721'::uuid,
    '2099-01-10',
    '2099-01-11',
    'Medical appointment',
    '[{"objectPath":"leave-requests/00000000-0000-4000-8000-000000000701/00000000-0000-4000-8000-000000000741/evidence.pdf","fileName":"evidence.pdf","mimeType":"application/pdf","sizeBytes":1024}]'::jsonb
  )$$,
  'Employee can submit an owned leave attachment'
);

select * from extensions.finish();

rollback;
