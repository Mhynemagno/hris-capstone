begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(32);

select extensions.has_table('private', 'notification_email_outbox', 'Private notification email outbox exists');
select extensions.has_function('public', 'claim_notification_email_jobs', array['integer'], 'Service worker claim RPC exists');
select extensions.has_function('public', 'complete_notification_email_job', array['uuid', 'text'], 'Service worker completion RPC exists');
select extensions.has_function('public', 'fail_notification_email_job', array['uuid', 'text', 'text', 'boolean'], 'Service worker failure RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'email.employee@example.test', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'email.applicant@example.test', now(), now());

insert into public.notifications (id, recipient_user_id, type, title, body, link)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'application_status_updated', 'Application updated', 'Sensitive applicant status details.', '/applicant/applications/b0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'application_remark_added', 'Application remark', 'Sensitive HR remark.', '/applicant/applications/b0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'leave_request_decision', 'Leave decided', 'Sensitive leave decision reason.', '/employee/leave'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'profile_change_decision', 'Profile decided', 'Sensitive profile decision reason.', '/employee/profile/change-requests'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'deployment_assigned', 'Deployment assigned', 'Sensitive deployment location.', '/employee/deployments'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'deployment_updated', 'Deployment updated', 'Sensitive updated deployment location.', '/employee/deployments'),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'password_changed', 'Password changed', 'Password changed in the portal.', '/employee/profile/security'),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'other_update', 'Other update', 'This remains in-app only.', '/notifications');

select extensions.is(
  (select count(*) from private.notification_email_outbox),
  6::bigint,
  'Only matrix-approved notifications create email jobs'
);
select extensions.is(
  (select string_agg(template_key, ',' order by notification_id) from private.notification_email_outbox),
  'application_update,application_remark,leave_decision,profile_change_decision,deployment_update,deployment_update',
  'Eligible notification types map to the expected email templates'
);
select extensions.is(
  (select string_agg(notification_title || ':' || notification_body, ',' order by notification_id) from private.notification_email_outbox),
  'Application updated:Sensitive applicant status details.,Application remark:Sensitive HR remark.,Leave decided:Sensitive leave decision reason.,Profile decided:Sensitive profile decision reason.,Deployment assigned:Sensitive deployment location.,Deployment updated:Sensitive updated deployment location.',
  'Eligible notifications snapshot their full in-app title and body for email delivery'
);
select extensions.is(
  (select notification_body from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000003'),
  'Sensitive leave decision reason.',
  'The email queue retains the complete leave decision content'
);
select extensions.ok(
  pg_get_functiondef('private.notify_deployment_assignment()'::regprocedure) not like '%new.status <> ''active''%',
  'Deployment notifications are not restricted to the obsolete active status'
);
select extensions.is(
  (select count(*) from private.notification_email_outbox where notification_id in ('b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000008')),
  0::bigint,
  'Password and unrecognised notification types never enqueue email'
);
select extensions.throws_ok(
  $$insert into private.notification_email_outbox (notification_id, recipient_user_id, template_key, continue_path, notification_title, notification_body) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'application_update', '/applicant/applications/b0000000-0000-0000-0000-000000000001', 'Application updated', 'Sensitive applicant status details.')$$,
  '23505', null,
  'A notification can create only one email job'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select extensions.throws_ok(
  $$select count(*) from private.notification_email_outbox$$,
  '42501', null,
  'Browser callers cannot inspect private email jobs'
);
select extensions.throws_ok(
  $$select * from public.claim_notification_email_jobs(10)$$,
  '42501', null,
  'Browser callers cannot claim email jobs'
);

set local role service_role;
select extensions.is(
  (select count(*) from public.claim_notification_email_jobs(10)),
  6::bigint,
  'The service worker claims every pending email job once'
);

set local role postgres;
select extensions.is(
  (select count(*) from private.notification_email_outbox where status = 'sending' and attempt_count = 1),
  6::bigint,
  'Claiming transitions jobs atomically to sending and increments attempts'
);

set local role postgres;
select extensions.lives_ok(
  $$select public.complete_notification_email_job((select id from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000001'), '<brevo-message-1@example.test>')$$,
  'The service worker can record Brevo acceptance'
);

set local role postgres;
select extensions.is(
  (select status from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000001'),
  'accepted',
  'A completed job becomes accepted'
);
select extensions.is(
  (select provider_message_id from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000001'),
  '<brevo-message-1@example.test>',
  'Brevo message IDs are retained for accepted jobs'
);

set local role postgres;
select extensions.lives_ok(
  $$select public.fail_notification_email_job((select id from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'), 'provider_unavailable', 'temporary', true)$$,
  'A retryable first failure is recorded'
);

set local role postgres;
select extensions.is(
  (select status from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'),
  'pending',
  'A retryable failure returns the job to pending'
);
select extensions.ok(
  (select available_at = now() + interval '5 minutes' from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'),
  'First retry waits five minutes'
);

update private.notification_email_outbox
set available_at = now()
where notification_id = 'b0000000-0000-0000-0000-000000000002';

set local role postgres;
select extensions.lives_ok($$select * from public.claim_notification_email_jobs(1)$$, 'The retried job can be claimed again');
select extensions.lives_ok(
  $$select public.fail_notification_email_job((select id from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'), 'provider_unavailable', 'temporary', true)$$,
  'A retryable second failure is recorded'
);

set local role postgres;
select extensions.ok(
  (select available_at = now() + interval '30 minutes' from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'),
  'Second retry waits thirty minutes'
);

update private.notification_email_outbox
set available_at = now()
where notification_id = 'b0000000-0000-0000-0000-000000000002';

set local role postgres;
select extensions.lives_ok($$select * from public.claim_notification_email_jobs(1)$$, 'The second retried job can be claimed again');
select extensions.lives_ok(
  $$select public.fail_notification_email_job((select id from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'), 'provider_unavailable', 'temporary', true)$$,
  'A retryable third failure is recorded'
);

set local role postgres;
select extensions.ok(
  (select available_at = now() + interval '2 hours' from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'),
  'Third retry waits two hours'
);

update private.notification_email_outbox
set available_at = now()
where notification_id = 'b0000000-0000-0000-0000-000000000002';

set local role postgres;
select extensions.lives_ok($$select * from public.claim_notification_email_jobs(1)$$, 'The final retried job can be claimed again');
select extensions.lives_ok(
  $$select public.fail_notification_email_job((select id from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'), 'provider_unavailable', 'temporary', true)$$,
  'The fourth retryable failure is recorded'
);

set local role postgres;
select extensions.is(
  (select status from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000002'),
  'failed',
  'The fourth failed attempt is terminal'
);

update private.notification_email_outbox
set locked_at = now() - interval '16 minutes'
where notification_id = 'b0000000-0000-0000-0000-000000000003';
select extensions.is(
  private.recover_stale_notification_email_jobs(),
  1,
  'Stale sending jobs are recovered exactly once'
);
select extensions.is(
  (select status from private.notification_email_outbox where notification_id = 'b0000000-0000-0000-0000-000000000003'),
  'pending',
  'Recovered stale jobs return to pending'
);

select * from extensions.finish();

rollback;
