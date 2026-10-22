begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(27);

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000140001', 'authenticated', 'authenticated', 'cycle-hr@example.test', '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000140002', 'authenticated', 'authenticated', 'cycle-applicant@example.test', '{"first_name":"Resubmit","last_name":"Applicant"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000140003', 'authenticated', 'authenticated', 'cycle-incomplete@example.test', '{}'::jsonb, now(), now());

update public.user_roles set role = 'hr_personnel'::public.app_role where user_id = '00000000-0000-4000-8000-000000140001';

-- ---------------------------------------------------------------------------
-- Recruitment cycles
-- ---------------------------------------------------------------------------

select extensions.has_column('public', 'job_openings', 'recruitment_cycle', 'Openings record their recruitment cycle');
select extensions.has_column('public', 'job_openings', 'recruitment_year', 'Openings record their recruitment year');

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('Cycle one opening', 'An opening published in the first half of the year.', 'San Juan City', '2026-06-30', 'published', '2026-03-10 09:00+08', '00000000-0000-4000-8000-000000140001');

select extensions.is(
  (select row(recruitment_cycle, recruitment_year)::text from public.job_openings where title = 'Cycle one opening'),
  row(1::smallint, 2026)::text,
  'An opening published in March belongs to Cycle 1 (January–June) of its year'
);

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('Cycle two opening', 'An opening published in the second half of the year.', 'San Juan City', '2026-12-31', 'published', '2026-07-01 00:30+08', '00000000-0000-4000-8000-000000140001');

select extensions.is(
  (select row(recruitment_cycle, recruitment_year)::text from public.job_openings where title = 'Cycle two opening'),
  row(2::smallint, 2026)::text,
  'An opening published on July 1 (Philippine time) belongs to Cycle 2 (July–December)'
);

select extensions.throws_ok(
  $$insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
    values ('Overlong opening', 'An opening whose deadline runs past its cycle.', 'San Juan City', '2026-07-01', 'published', '2026-03-10 09:00+08', '00000000-0000-4000-8000-000000140001')$$,
  '22023',
  'The deadline of application must fall within Cycle 1 (January–June 2026). Choose a date on or before June 30, 2026.',
  'A deadline after June 30 is refused for a Cycle 1 opening'
);

select extensions.throws_ok(
  $$update public.job_openings set closes_on = '2027-01-05' where title = 'Cycle two opening'$$,
  '22023', null,
  'Moving a Cycle 2 deadline into the next year is refused'
);

insert into public.job_openings (title, description, location, status, created_by_user_id)
values ('Draft cycle opening', 'A draft opening without a publication date yet.', 'San Juan City', 'draft', '00000000-0000-4000-8000-000000140001');

select extensions.is(
  (select row(recruitment_cycle, recruitment_year)::text from public.job_openings where title = 'Draft cycle opening'),
  row(
    (case when extract(month from (now() at time zone 'Asia/Manila')) <= 6 then 1 else 2 end)::smallint,
    extract(year from (now() at time zone 'Asia/Manila'))::integer
  )::text,
  'A draft belongs to the cycle of today, the day it would open'
);

update public.job_openings set recruitment_cycle = 2, recruitment_year = 2030 where title = 'Cycle one opening';
select extensions.is(
  (select row(recruitment_cycle, recruitment_year)::text from public.job_openings where title = 'Cycle one opening'),
  row(1::smallint, 2026)::text,
  'The cycle is derived by the database and cannot be overwritten'
);

update public.job_openings set status = 'closed', published_at = null where title = 'Cycle one opening';
select extensions.is(
  (select row(recruitment_cycle, recruitment_year)::text from public.job_openings where title = 'Cycle one opening'),
  row(1::smallint, 2026)::text,
  'A closed opening keeps the cycle it ran in'
);

-- A legacy opening that already breaks the rule is kept and can still be edited.
alter table public.job_openings disable trigger job_openings_assign_recruitment_cycle;
insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id, recruitment_cycle, recruitment_year)
values ('Legacy long opening', 'An opening created before recruitment cycles existed.', 'San Juan City', '2027-03-31', 'published', '2026-03-10 09:00+08', '00000000-0000-4000-8000-000000140001', 1, 2026);
alter table public.job_openings enable trigger job_openings_assign_recruitment_cycle;

select extensions.lives_ok(
  $$update public.job_openings set title = 'Legacy long opening (edited)', location = 'San Juan City Hall' where title = 'Legacy long opening'$$,
  'Existing openings outside their cycle are not rejected by unrelated edits'
);
select extensions.lives_ok(
  $$update public.job_openings set closes_on = closes_on where title = 'Legacy long opening (edited)'$$,
  'Re-saving an unchanged deadline does not reject a legacy opening'
);

-- ---------------------------------------------------------------------------
-- Registered applicant directory
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000140001';

select extensions.is(
  (select row(applicant_number is not null, account_active)::text from public.list_hr_registered_applicants() where user_id = '00000000-0000-4000-8000-000000140002'),
  row(true, true)::text,
  'HR sees each registered applicant with an applicant number and whether the account can sign in'
);
select extensions.is(
  (select count(*) from public.list_hr_registered_applicants() where user_id = '00000000-0000-4000-8000-000000140003'),
  0::bigint,
  'Accounts without an applicant record (and therefore without a number) are not listed'
);
select extensions.is(
  (select count(*) from public.list_hr_registered_applicants() where applicant_number is null),
  0::bigint,
  'No registered applicant is listed without an applicant number'
);

-- ---------------------------------------------------------------------------
-- Reactivating an applicant account
-- ---------------------------------------------------------------------------

set local role postgres;
update public.profiles set is_active = false where id = '00000000-0000-4000-8000-000000140002';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000140003';
select extensions.throws_ok(
  $$select public.reactivate_applicant_account('00000000-0000-4000-8000-000000140002')$$,
  '42501', 'HR access is required.',
  'Applicants cannot reactivate accounts'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000140001';
select extensions.throws_ok(
  $$select public.reactivate_applicant_account('00000000-0000-4000-8000-000000140001')$$,
  'P0001', 'Applicant account was not found.',
  'HR can reactivate only applicant accounts'
);
select extensions.lives_ok(
  $$select public.reactivate_applicant_account('00000000-0000-4000-8000-000000140002')$$,
  'HR reactivates a deactivated applicant account'
);

set local role postgres;
select extensions.ok(
  (select is_active from public.profiles where id = '00000000-0000-4000-8000-000000140002'),
  'The reactivated applicant account can sign in again'
);
select extensions.is(
  (select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000140002' and action = 'applicant_account_reactivated' and actor_user_id = '00000000-0000-4000-8000-000000140001'),
  1::bigint,
  'Reactivation is audited with the HR actor'
);

set local role anon;
select extensions.throws_ok(
  $$select public.reactivate_applicant_account('00000000-0000-4000-8000-000000140002')$$,
  '42501', null,
  'Anonymous visitors cannot call the reactivation RPC'
);

-- ---------------------------------------------------------------------------
-- Reopening a Not Selected application
-- ---------------------------------------------------------------------------

set local role postgres;
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000140101', applicant.id, opening.id, 'Not Selected'
from public.applicants applicant
join public.job_openings opening on opening.title = 'Cycle two opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000140002';
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000140102', applicant.id, opening.id, 'Panel Interview'
from public.applicants applicant
join public.job_openings opening on opening.title = 'Draft cycle opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000140002';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000140002';
select extensions.throws_ok(
  $$select public.reopen_application_for_resubmission('00000000-0000-4000-8000-000000140101', null)$$,
  '42501', 'HR access is required.',
  'Applicants cannot reopen their own application'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000140001';
select extensions.throws_ok(
  $$select public.reopen_application_for_resubmission('00000000-0000-4000-8000-000000140102', null)$$,
  '22023', 'Only a Not Selected application can be reopened for resubmission.',
  'Only Not Selected applications can be reopened'
);
select extensions.lives_ok(
  $$select public.reopen_application_for_resubmission('00000000-0000-4000-8000-000000140101', 'Upload a clearer diploma.')$$,
  'HR reopens a Not Selected application for resubmission'
);
select extensions.is(
  (select row(status, stage_result)::text from public.applications where id = '00000000-0000-4000-8000-000000140101'),
  row('Application Submission', 'pending')::text,
  'The application returns to Application Submission, pending review'
);
select extensions.is(
  (select row(previous_status, next_status, note)::text from public.application_status_history where application_id = '00000000-0000-4000-8000-000000140101' order by created_at desc limit 1),
  row('Not Selected', 'Application Submission', 'Upload a clearer diploma.')::text,
  'The reopening is kept in the application history'
);

set local role postgres;
select extensions.is(
  (select count(*) from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000140002' and title = 'Application reopened'),
  1::bigint,
  'The applicant is notified that the application was reopened'
);
select extensions.is(
  (select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000140101' and action = 'reopened_for_resubmission'),
  1::bigint,
  'Reopening is audited'
);

select * from extensions.finish();
rollback;
