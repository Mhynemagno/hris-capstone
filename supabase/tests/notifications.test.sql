begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(15);

select extensions.has_table('public', 'notifications', 'Notifications table exists');
select extensions.has_column('public', 'notifications', 'recipient_user_id', 'Notifications have a recipient');
select extensions.has_function('public', 'mark_notification_read', array['uuid'], 'Single-read notification RPC exists');
select extensions.has_function('public', 'mark_all_notifications_read', array[]::text[], 'Mark-all notification RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'employee.fixture@example.com', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'management.fixture@example.com', now(), now());

insert into public.notifications (id, recipient_user_id, type, title, body, link)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'profile_change_decision', 'Profile updated', 'Your profile update was approved.', '/employee/profile'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'leave_decision', 'Leave request updated', 'Your leave request was approved.', '/employee/leave');

select extensions.throws_ok(
  $$insert into public.notifications (recipient_user_id, type, title, body) values ('00000000-0000-0000-0000-000000000004', 'bad type', 'Invalid type', 'Rejected')$$,
  '23514', null,
  'Notification types must be lowercase snake case'
);
select extensions.throws_ok(
  $$insert into public.notifications (recipient_user_id, type, title, body, link) values ('00000000-0000-0000-0000-000000000004', 'profile_change_decision', 'Invalid link', 'Rejected', 'https://example.com')$$,
  '23514', null,
  'Notification links must remain internal'
);

set local role anon;
select extensions.throws_ok(
  $$select count(*) from public.notifications$$,
  '42501', null,
  'Anonymous users cannot read notifications'
);
select extensions.throws_ok(
  $$select public.mark_all_notifications_read()$$,
  '42501', null,
  'Anonymous users cannot mark notifications read'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select extensions.is(
  (select count(*) from public.notifications),
  1::bigint,
  'A recipient reads only their own notifications'
);
select extensions.throws_ok(
  $$update public.notifications set title = 'Forged' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'Recipients have no broad notification update permission'
);
select extensions.lives_ok(
  $$select public.mark_notification_read('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'A recipient can mark their notification read'
);

set local role postgres;
select extensions.is(
  (select read_at is not null from public.notifications where id = '10000000-0000-0000-0000-000000000001'),
  true,
  'The recipient notification was marked read'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select extensions.lives_ok(
  $$select public.mark_notification_read('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'A cross-user notification read request is a harmless no-op'
);
select extensions.lives_ok(
  $$select public.mark_all_notifications_read()$$,
  'A recipient can mark all of their unread notifications read'
);

set local role postgres;
select extensions.is(
  (select read_at from public.notifications where id = '10000000-0000-0000-0000-000000000002'),
  null::timestamptz,
  'Marking read never changes another recipient notification'
);

select * from extensions.finish();

rollback;
