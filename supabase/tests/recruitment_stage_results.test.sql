begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(28);

select extensions.has_function('public', 'record_stage_result', array['uuid', 'text', 'text', 'jsonb', 'timestamp with time zone', 'text'], 'HR records Passed / Failed / Scheduled / Verified results');
select extensions.has_table('public', 'application_stage_documents', 'Stage supporting documents are stored');

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('Stage result test opening', 'Opening for stage result tests.', 'San Juan City', (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'published', now(), '00000000-0000-4000-8000-000000008102');
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000028001', applicant.id, opening.id, 'Application Submission'
from public.applicants applicant
join public.job_openings opening on opening.title = 'Stage result test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000008104';

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000028101', 'recruitment-stage-documents',
  'applications/00000000-0000-4000-8000-000000028001/agility-result.pdf',
  '00000000-0000-4000-8000-000000008102', '00000000-0000-4000-8000-000000008102',
  '{"mimetype":"application/pdf","size":2048}'::jsonb
), (
  '00000000-0000-4000-8000-000000028102', 'recruitment-stage-documents',
  'applications/00000000-0000-4000-8000-000000028001/medical-result.pdf',
  '00000000-0000-4000-8000-000000008102', '00000000-0000-4000-8000-000000008102',
  '{"mimetype":"application/pdf","size":2048}'::jsonb
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';

select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'verified', 'Documents complete', null);
select extensions.is((select stage_result from public.applications where id = '00000000-0000-4000-8000-000000028001'), 'verified', 'HR marks the submitted documents as verified');

select extensions.lives_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'passed', null, null)$$,
  'Application Submission can be passed without an extra document'
);
select extensions.is(
  (select array[status, stage_result] from public.applications where id = '00000000-0000-4000-8000-000000028001'),
  array['Physical Agility Test', 'pending'],
  'Passing moves the applicant to the next stage, pending evaluation'
);

select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'scheduled', 'Monday 8 AM', null);
select extensions.is((select stage_result from public.applications where id = '00000000-0000-4000-8000-000000028001'), 'scheduled', 'HR marks the test as scheduled');

select extensions.throws_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'passed', null, null)$$,
  '22023', 'Upload a supporting document for this result.', 'A test stage needs a supporting document to pass'
);
select extensions.throws_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'verified', null, null)$$,
  '22023', null, 'Verified is only for Application Submission'
);

select extensions.lives_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'passed', 'Passed all events',
      '{"objectPath":"applications/00000000-0000-4000-8000-000000028001/agility-result.pdf","fileName":"agility-result.pdf","mimeType":"application/pdf","sizeBytes":2048}'::jsonb)$$,
  'HR passes the Physical Agility Test with the result sheet attached'
);
select extensions.is(
  (select array[stage, result, file_name] from public.application_stage_documents where application_id = '00000000-0000-4000-8000-000000028001'),
  array['Physical Agility Test', 'passed', 'agility-result.pdf'],
  'The supporting document is kept with its stage and result'
);
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000028001'), 'Physical & Medical Examination', 'The applicant moved on');

select extensions.lives_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'failed', 'Did not meet the medical standard',
      '{"objectPath":"applications/00000000-0000-4000-8000-000000028001/medical-result.pdf","fileName":"medical-result.pdf","mimeType":"application/pdf","sizeBytes":2048}'::jsonb)$$,
  'HR can fail an applicant at any stage with a document'
);
select extensions.is(
  (select array[status, (select result from public.application_status_history where application_id = '00000000-0000-4000-8000-000000028001' and next_status = 'Not Selected')] from public.applications where id = '00000000-0000-4000-8000-000000028001'),
  array['Not Selected', 'failed'],
  'Failing ends the application as Not Selected (Disqualified) and the history records the result'
);
set local role postgres;
select extensions.is(
  (select is_active from public.profiles where id = '00000000-0000-4000-8000-000000008104'),
  true,
  'Failing a recruitment stage keeps permanent account activation separate from the temporary cooling-off block'
);
select extensions.ok(
  (select applicant_cooling_off_ends_at between now() + interval '6 months - 5 seconds' and now() + interval '6 months + 5 seconds' from public.profiles where id = '00000000-0000-4000-8000-000000008104'),
  'Failing a recruitment stage records a six-month cooling-off end time'
);
select extensions.ok(
  (select banned_until > now() from auth.users where id = '00000000-0000-4000-8000-000000008104'),
  'The rejected applicant is banned in Supabase Auth as well as the application profile'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008104';
select extensions.is(
  public.current_account_can_sign_in(),
  false,
  'A rejected applicant remains unable to access protected data during the real cooling-off period'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008101';
select extensions.lives_ok(
  $$select public.set_applicant_login_presentation_demo('demo.applicant@example.test', 'start')$$,
  'A System Administrator can start the isolated six-month presentation simulation'
);
select extensions.is(
  (select email from public.get_applicant_login_presentation_demo()),
  'demo.applicant@example.test',
  'The presentation simulation records only its selected applicant'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008104';
select extensions.is(
  public.current_account_can_sign_in(),
  true,
  'The selected applicant can access protected data while the isolated simulation is active'
);

set local role postgres;
update public.applicant_login_presentation_demo set expires_at = now() - interval '1 second' where id;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008104';
select extensions.is(
  public.current_account_can_sign_in(),
  false,
  'An expired presentation simulation no longer grants protected-data access'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008101';
select extensions.lives_ok(
  $$select public.set_applicant_login_presentation_demo('', 'reset')$$,
  'A System Administrator can reset the presentation simulation'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008104';
select extensions.is(
  public.current_account_can_sign_in(),
  false,
  'Resetting the simulation restores the real cooling-off block'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008104';
select extensions.throws_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'scheduled', null, null)$$,
  '42501', null, 'Applicants cannot record stage results'
);
select extensions.is((select count(*) from public.application_stage_documents), 0::bigint, 'Applicants cannot read HR stage documents');

-- Review fixes: a missing result is rejected, and only HR can use the stage documents bucket.
set local role postgres;
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000028002', applicant.id, opening.id, 'Physical Agility Test'
from public.applicants applicant
join public.job_openings opening on opening.title = 'Stage result test opening'
where applicant.profile_id = '00000000-0000-4000-8000-000000008104'
on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select extensions.throws_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', null, null, null)$$,
  '22023', 'Choose a valid result.', 'A missing result is rejected instead of advancing the stage'
);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008104';
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('recruitment-stage-documents', 'applications/00000000-0000-4000-8000-000000028001/fake.pdf', '00000000-0000-4000-8000-000000008104')$$,
  '42501', null, 'An applicant cannot upload into the stage documents bucket'
);
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'recruitment-stage-documents'),
  0::bigint, 'An applicant cannot see stage documents in storage'
);

select * from extensions.finish();

rollback;
