begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

-- A brand-new self-registered applicant.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003001', 'authenticated', 'authenticated', 'accept-me@example.test',
  '{"first_name":"Nora","last_name":"Santos","registration":"applicant"}'::jsonb, now(), now());

select extensions.is(
  (select applicant_number is not null from public.applicants where profile_id = '00000000-0000-4000-8000-000000003001'),
  true, 'Registration assigns an applicant number before documents are submitted');
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000003001'),
  0::bigint, 'Nothing is sent about an applicant number at sign-up');

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('Acceptance test opening', 'Opening for acceptance tests.', 'San Juan City', (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'published', now(), '00000000-0000-4000-8000-000000008102');

insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000030001', applicant.id, opening.id, 'Application Submission'
from public.applicants applicant join public.job_openings opening on opening.title = 'Acceptance test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000003001';

update public.applications set stage_result = 'verified' where id = '00000000-0000-4000-8000-000000030001';
select extensions.is(
  (select applicant_number is not null from public.applicants where profile_id = '00000000-0000-4000-8000-000000003001'),
  true, 'Verifying documents retains the existing applicant number');

-- Force the counter to 99 so the next number is the 100th of the year (padding bug regression).
insert into private.applicant_number_counters (registration_year, last_value)
values (extract(year from now() at time zone 'Asia/Manila')::integer, 99)
on conflict (registration_year) do update set last_value = 99;

update public.applications set status = 'Physical Agility Test', stage_result = 'pending' where id = '00000000-0000-4000-8000-000000030001';

select extensions.is(
  (select applicant_number is not null from public.applicants where profile_id = '00000000-0000-4000-8000-000000003001'),
  true, 'Passing Application Submission retains the existing number');
select extensions.is(
  (select body from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000003001' and type = 'applicant_number_assigned'),
  null::text,
  'Acceptance does not issue a second applicant-number notification');
select extensions.is(
  (select job.template_key from private.notification_email_outbox job join public.notifications n on n.id = job.notification_id
   where n.recipient_user_id = '00000000-0000-4000-8000-000000003001' and n.type = 'applicant_number_assigned'),
  null::text, 'No acceptance-only applicant-number email is sent');

-- Moving on again does not re-issue.
update public.applications set status = 'Physical & Medical Examination' where id = '00000000-0000-4000-8000-000000030001';
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000003001' and type = 'applicant_number_assigned'),
  0::bigint, 'No number notification is sent on later stage changes');

-- An applicant who already has a number keeps it.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003002', 'authenticated', 'authenticated', 'old-applicant@example.test',
  '{"first_name":"Old","last_name":"Number","registration":"applicant"}'::jsonb, now(), now());
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000030002', applicant.id, opening.id, 'Application Submission'
from public.applicants applicant join public.job_openings opening on opening.title = 'Acceptance test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000003002';
update public.applications set status = 'Physical Agility Test' where id = '00000000-0000-4000-8000-000000030002';
select extensions.is(
  (select applicant_number is not null from public.applicants where profile_id = '00000000-0000-4000-8000-000000003002'),
  true, 'An existing applicant number is kept');

-- Failing Application Submission issues nothing.
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003003', 'authenticated', 'authenticated', 'failed@example.test',
  '{"first_name":"Fail","last_name":"Ed","registration":"applicant"}'::jsonb, now(), now());
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000030003', applicant.id, opening.id, 'Application Submission'
from public.applicants applicant join public.job_openings opening on opening.title = 'Acceptance test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000003003';
update public.applications set status = 'Not Selected' where id = '00000000-0000-4000-8000-000000030003';
select extensions.is(
  (select applicant_number is not null from public.applicants where profile_id = '00000000-0000-4000-8000-000000003003'),
  true, 'A disqualified applicant retains a number for record recovery');

select * from extensions.finish();
rollback;
