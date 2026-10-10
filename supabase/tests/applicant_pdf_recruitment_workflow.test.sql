begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(17);

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('PDF workflow test opening', 'A test opening for the eight-stage applicant recruitment workflow.', 'San Juan City', current_date + 30, 'published', now(), '00000000-0000-4000-8000-000000008102');

insert into public.applications (id, applicant_id, job_opening_id, status)
select
  '00000000-0000-4000-8000-000000018001',
  applicant.id,
  opening.id,
  'Application Submission'
from public.applicants applicant
join public.job_openings opening on opening.title = 'PDF workflow test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000008104';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';

select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Physical Agility Test', null)$$,
  'HR can advance Application Submission to Physical Agility Test'
);
select extensions.is(
  (select status from public.applications where id = '00000000-0000-4000-8000-000000018001'),
  'Physical Agility Test',
  'Physical Agility Test is persisted'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Physical & Medical Examination', null)$$,
  'HR can advance to Physical and Medical Examination'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Neuro-Psychiatric Examination', null)$$,
  'HR can advance to Neuro-Psychiatric Examination'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Drug Test', null)$$,
  'HR can advance to Drug Test'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Character & Background Investigation', null)$$,
  'HR can advance to Character and Background Investigation'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Panel Interview', null)$$,
  'HR can advance to Panel Interview'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Final Evaluation', null)$$,
  'HR can advance to Final Evaluation'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Shortlisted', 'Completed the recruitment process.')$$,
  'Only Final Evaluation can shortlist an applicant'
);
select extensions.is(
  (select status from public.applications where id = '00000000-0000-4000-8000-000000018001'),
  'Shortlisted',
  'Shortlisting is a terminal outcome after Final Evaluation'
);

set local role postgres;
select extensions.ok(
  exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000008104' and link = '/applicant/applications/00000000-0000-4000-8000-000000018001' and body = 'You have been shortlisted. Note: Completed the recruitment process.'),
  'The applicant receives the final evaluation outcome notification'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select extensions.throws_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018001', 'Panel Interview', null)$$,
  '22023', 'Invalid application status transition.',
  'A terminal shortlisted application cannot return to a pipeline stage'
);

set local role postgres;
insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('PDF workflow skip test opening', 'A second test opening for rejection and skip validation.', 'San Juan City', current_date + 30, 'published', now(), '00000000-0000-4000-8000-000000008102');
insert into public.applications (id, applicant_id, job_opening_id, status)
select
  '00000000-0000-4000-8000-000000018002',
  applicant.id,
  opening.id,
  'Application Submission'
from public.applicants applicant
join public.job_openings opening on opening.title = 'PDF workflow skip test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000008104';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select extensions.throws_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018002', 'Shortlisted', null)$$,
  '22023', 'Invalid application status transition.',
  'HR cannot shortlist before Final Evaluation'
);
select extensions.throws_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000018002', 'Drug Test', null)$$,
  '22023', 'Invalid application status transition.',
  'HR cannot skip pipeline stages'
);
select extensions.throws_ok(
  $$select public.hire_application('00000000-0000-4000-8000-000000018002', 'PAT-TEST', null)$$,
  '22023', 'Only shortlisted applicants can be hired.',
  'Hiring is blocked before Final Evaluation shortlisting'
);

set local role postgres;
-- An applicant who chose "prefer not to say" can still be hired; personnel gender is left blank for HR to set.
update public.applicants set gender = 'prefer_not_to_say' where profile_id = '00000000-0000-4000-8000-000000008104';
insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('PDF workflow hire test opening', 'A third test opening for hiring.', 'San Juan City', current_date + 30, 'published', now(), '00000000-0000-4000-8000-000000008102');
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000018003', applicant.id, opening.id, 'Shortlisted'
from public.applicants applicant
join public.job_openings opening on opening.title = 'PDF workflow hire test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000008104';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select extensions.lives_ok(
  $$select public.hire_application('00000000-0000-4000-8000-000000018003', '9-87654', null)$$,
  'HR can hire an applicant whose gender is prefer not to say'
);
set local role postgres;
select extensions.ok(
  (select gender is null from public.employees where profile_id = '00000000-0000-4000-8000-000000008104'),
  'The hired employee starts with a blank gender for HR to set'
);

select * from extensions.finish();
rollback;
