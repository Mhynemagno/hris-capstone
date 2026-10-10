begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(4);

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002901', 'authenticated', 'authenticated', 'new-applicant@example.test',
   '{"first_name":"Nora","last_name":"Santos","date_of_birth":"2000-01-01","registration":"applicant"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002902', 'authenticated', 'authenticated', 'invited-staff@example.test',
   '{"first_name":"Ivan","last_name":"Staff","full_name":"Ivan Staff"}'::jsonb, now(), now());

select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000002901' and type = 'applicant_registered'),
  1::bigint, 'A self-registered applicant gets an applicant number notification'
);
select extensions.ok(
  (select notification.body like '%Your applicant number is ' || left(lpad(applicant.applicant_number::text, 6, '0'), 1) || '-' || substr(lpad(applicant.applicant_number::text, 6, '0'), 2) || '.%'
   from public.notifications notification
   join public.applicants applicant on applicant.profile_id = notification.recipient_user_id
   where notification.recipient_user_id = '00000000-0000-4000-8000-000000002901' and notification.type = 'applicant_registered'),
  'The notification states the applicant number as it is shown in the app'
);
select extensions.is(
  (select template_key from private.notification_email_outbox job join public.notifications notification on notification.id = job.notification_id
   where notification.recipient_user_id = '00000000-0000-4000-8000-000000002901' and notification.type = 'applicant_registered'),
  'applicant_welcome', 'The applicant number is queued for email'
);
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000002902' and type = 'applicant_registered'),
  0::bigint, 'An account an administrator invites gets no applicant number email'
);

select * from extensions.finish();

rollback;
