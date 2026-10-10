begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(15);

select extensions.has_function('public', 'record_stage_result', array['uuid', 'text', 'text', 'jsonb'], 'HR records Passed / Failed / Scheduled / Verified results');
select extensions.has_table('public', 'application_stage_documents', 'Stage supporting documents are stored');

insert into public.job_openings (title, description, location, closes_on, status, published_at, created_by_user_id)
values ('Stage result test opening', 'Opening for stage result tests.', 'San Juan City', current_date + 30, 'published', now(), '00000000-0000-4000-8000-000000008102');
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

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008104';
select extensions.throws_ok(
  $$select public.record_stage_result('00000000-0000-4000-8000-000000028001', 'scheduled', null, null)$$,
  '42501', null, 'Applicants cannot record stage results'
);
select extensions.is((select count(*) from public.application_stage_documents), 0::bigint, 'Applicants cannot read HR stage documents');

select * from extensions.finish();

rollback;
