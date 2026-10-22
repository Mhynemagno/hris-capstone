begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(14);

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id) values
  ('Older open posting', 'Older posting for redesign tests.', 'San Juan City', (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'published', now() - interval '2 days', '00000000-0000-4000-8000-000000008102'),
  ('Newest open posting', 'Newest posting for redesign tests.', 'San Juan City', (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'published', now() - interval '1 day', '00000000-0000-4000-8000-000000008102'),
  ('Draft posting', 'Draft posting for redesign tests.', 'San Juan City', null, 'draft', null, '00000000-0000-4000-8000-000000008102');

-- Registration remembers a published posting and ignores anything else.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-4000-8000-000000004001', 'authenticated', 'authenticated', 'prefers@example.test',
  jsonb_build_object('first_name', 'Pia', 'last_name', 'Ramos', 'registration', 'applicant', 'preferred_job_opening_id', id::text), now(), now()
from public.job_openings where title = 'Older open posting';
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-4000-8000-000000004002', 'authenticated', 'authenticated', 'draft-pref@example.test',
  jsonb_build_object('first_name', 'Dan', 'last_name', 'Cruz', 'registration', 'applicant', 'preferred_job_opening_id', id::text), now(), now()
from public.job_openings where title = 'Draft posting';

select extensions.is(
  (select opening.title from public.applicants applicant join public.job_openings opening on opening.id = applicant.preferred_job_opening_id
   where applicant.profile_id = '00000000-0000-4000-8000-000000004001'),
  'Older open posting', 'The posting chosen before registering is remembered');
select extensions.is(
  (select preferred_job_opening_id from public.applicants where profile_id = '00000000-0000-4000-8000-000000004002'),
  null::bigint, 'An unpublished posting is not remembered');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004001';
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Older open posting', 'The remembered posting is the target');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004002';
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Newest open posting', 'Without a remembered posting the newest open posting is the target');

select extensions.throws_ok(
  $$select public.set_my_preferred_job_opening((select id from public.job_openings where title = 'Draft posting'))$$,
  'P0001', 'The selected job opening is not accepting applications.', 'An unpublished posting cannot be chosen');
select extensions.lives_ok(
  $$select public.set_my_preferred_job_opening((select id from public.job_openings where title = 'Older open posting'))$$,
  'A signed-in applicant can choose an open posting');
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Older open posting', 'The newly chosen posting becomes the target');

-- A remembered posting that closed falls back to the newest open one.
set local role postgres;
update public.job_openings set status = 'closed', published_at = null where title = 'Older open posting';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004001';
select extensions.is((select title from public.job_openings where id = public.my_application_target_job()), 'Newest open posting', 'A closed remembered posting falls back to the newest open posting');

-- Stage schedule.
set local role postgres;
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000040001', applicant.id, opening.id, 'Physical Agility Test'
from public.applicants applicant join public.job_openings opening on opening.title = 'Newest open posting'
where applicant.profile_id = '00000000-0000-4000-8000-000000004001';
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata) values (
  '00000000-0000-4000-8000-000000040101', 'recruitment-stage-documents',
  'applications/00000000-0000-4000-8000-000000040001/agility.pdf',
  '00000000-0000-4000-8000-000000008102', '00000000-0000-4000-8000-000000008102', '{"mimetype":"application/pdf","size":2048}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select public.record_stage_result('00000000-0000-4000-8000-000000040001', 'scheduled', 'Bring PT uniform', null, '2026-10-17T22:00:00Z', ' Grandstand Sports Complex ');
set local role postgres;
select extensions.is(
  (select array[stage_scheduled_at::text, stage_venue] from public.applications where id = '00000000-0000-4000-8000-000000040001'),
  array['2026-10-17 22:00:00+00', 'Grandstand Sports Complex'], 'HR stores the stage date/time and venue');
select extensions.is(
  (select body from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000004001' and type = 'application_status_updated' order by created_at desc limit 1),
  'You are scheduled for the Physical Agility Test on October 18, 2026, 6:00 AM at Grandstand Sports Complex. Note: Bring PT uniform',
  'The applicant is told when and where');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select public.record_stage_result('00000000-0000-4000-8000-000000040001', 'passed', null,
  '{"objectPath":"applications/00000000-0000-4000-8000-000000040001/agility.pdf","fileName":"agility.pdf","mimeType":"application/pdf","sizeBytes":2048}'::jsonb);
set local role postgres;
select extensions.is(
  (select array[stage_scheduled_at::text, stage_venue] from public.applications where id = '00000000-0000-4000-8000-000000040001'),
  array[null, null]::text[], 'Moving to the next stage clears the schedule');

-- Notification delete is limited to the owner.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004002';
select public.delete_my_notifications();
set local role postgres;
select extensions.ok(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000004001') > 0,
  'Clearing my notifications leaves other people''s alone');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000004001';
select public.delete_my_notification((select id from public.notifications order by created_at limit 1));
select public.delete_my_notifications();
set local role postgres;
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000004001'),
  0::bigint, 'An applicant can delete and clear their own notifications');
select extensions.has_function('public', 'record_stage_result', array['uuid', 'text', 'text', 'jsonb', 'timestamp with time zone', 'text'], 'record_stage_result takes a schedule');

select * from extensions.finish();
rollback;
