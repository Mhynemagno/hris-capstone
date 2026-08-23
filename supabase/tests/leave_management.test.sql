begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(10);

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

select * from extensions.finish();

rollback;
