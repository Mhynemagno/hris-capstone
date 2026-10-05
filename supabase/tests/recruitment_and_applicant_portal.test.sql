begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(87);

delete from public.applications;
delete from public.job_openings;

select extensions.has_table('public', 'job_openings', 'Job openings table exists');
select extensions.has_table('public', 'job_qualification_criteria', 'Job qualification criteria table exists');
select extensions.has_table('public', 'applicants', 'Applicant profiles table exists');
select extensions.has_table('public', 'applications', 'Applications table exists');
select extensions.has_table('public', 'application_status_history', 'Application history table exists');
select extensions.has_table('public', 'applicant_documents', 'Applicant document metadata table exists');
select extensions.has_table('public', 'employee_activation_requests', 'Employee activation request table exists');
select extensions.has_table('public', 'application_ai_scores', 'Application AI scores table exists');
select extensions.has_function(
  'public',
  'list_hr_application_shortlist',
  array['text', 'text', 'smallint'],
  'HR AI shortlist query exists'
);
select extensions.has_function(
  'public',
  'save_job_opening',
  array['bigint', 'bigint', 'bigint', 'text', 'text', 'text', 'date', 'text', 'jsonb'],
  'Transactional job-opening save workflow exists'
);
select extensions.ok(
  exists (
    select 1
    from pg_namespace queue_schema
    where queue_schema.nspname = 'pgmq_public'
      and has_schema_privilege('service_role', queue_schema.oid, 'usage')
      and not has_schema_privilege('authenticated', queue_schema.oid, 'usage')
  ),
  'The queue API is available only to the service role'
);

insert into auth.users (id, aud, role, email, created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000009100', 'authenticated', 'authenticated', 'provisioned-applicant@example.test', now(), now(), '{"first_name":"Auto","last_name":"Applicant","full_name":"Auto Applicant"}'::jsonb),
  ('00000000-0000-4000-8000-000000009101', 'authenticated', 'authenticated', 'recruitment-hr@example.test', now(), now(), '{}'::jsonb),
  ('00000000-0000-4000-8000-000000009102', 'authenticated', 'authenticated', 'recruitment-applicant@example.test', now(), now(), '{}'::jsonb),
  ('00000000-0000-4000-8000-000000009103', 'authenticated', 'authenticated', 'recruitment-admin@example.test', now(), now(), '{}'::jsonb);

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000009101'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000009103'::uuid then 'system_administrator'::public.app_role
  else 'applicant'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000009101'::uuid,
  '00000000-0000-4000-8000-000000009102'::uuid,
  '00000000-0000-4000-8000-000000009103'::uuid
);

select extensions.is(
  (select first_name from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid),
  'Auto',
  'Auth registration provisions the applicant first name'
);
select extensions.is(
  (select last_name from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid),
  'Applicant',
  'Auth registration provisions the applicant last name'
);
select extensions.is(
  (select count(*) from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid),
  1::bigint,
  'Auth registration provisions only one applicant row'
);
select extensions.is(
  (select count(*) from public.applicants where profile_id = '00000000-0000-4000-8000-000000009101'::uuid),
  0::bigint,
  'Metadata-free internal Auth users are not forced into applicant profiles'
);

insert into public.departments (name) values ('Recruitment test department');
insert into public.ranks (name, code, sort_order) values ('Recruitment test rank', 'RTR', 9201);
insert into public.ranks (name, code, sort_order) values ('Patrolman / Patrolwoman', 'PAT', 9202) on conflict (code) do nothing;

insert into public.job_openings (department_id, rank_id, title, description, status, published_at, created_by_user_id)
select department.id, rank.id, opening.title, opening.description, opening.status, opening.published_at, '00000000-0000-4000-8000-000000009101'::uuid
from public.departments department
cross join (select id from public.ranks where code = 'RTR') rank
cross join (
  values
    ('Published recruitment opening', 'A published opening visible to the public and applicants.', 'published'::text, now()),
    ('Draft recruitment opening', 'A draft opening visible only to Human Resources personnel.', 'draft'::text, null::timestamptz)
) as opening(title, description, status, published_at)
where department.name = 'Recruitment test department';

set local role anon;
select extensions.is((select count(*) from public.job_openings), 1::bigint, 'Anonymous visitors can read only published openings');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.is((select count(*) from public.job_openings), 1::bigint, 'Applicants can read only published openings');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.is((select count(*) from public.job_openings), 2::bigint, 'HR can read draft and published openings');

set local role postgres;
insert into public.applicants (id, profile_id, first_name, last_name)
values ('00000000-0000-4000-8000-000000009201', '00000000-0000-4000-8000-000000009102', 'Applicant', 'Fixture');

insert into public.applicant_profile_documents (applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
values
  ('00000000-0000-4000-8000-000000009201', 'eligibility', 'applicant-profiles/00000000-0000-4000-8000-000000009102/00000000-0000-4000-8000-000000009311.pdf', 'eligibility.pdf', 'application/pdf', 1024, '00000000-0000-4000-8000-000000009102'),
  ('00000000-0000-4000-8000-000000009201', 'diploma', 'applicant-profiles/00000000-0000-4000-8000-000000009102/00000000-0000-4000-8000-000000009312.pdf', 'diploma.pdf', 'application/pdf', 1024, '00000000-0000-4000-8000-000000009102'),
  ((select id from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid), 'eligibility', 'applicant-profiles/00000000-0000-4000-8000-000000009100/00000000-0000-4000-8000-000000009313.pdf', 'eligibility.pdf', 'application/pdf', 1024, '00000000-0000-4000-8000-000000009100'),
  ((select id from public.applicants where profile_id = '00000000-0000-4000-8000-000000009100'::uuid), 'diploma', 'applicant-profiles/00000000-0000-4000-8000-000000009100/00000000-0000-4000-8000-000000009314.pdf', 'diploma.pdf', 'application/pdf', 1024, '00000000-0000-4000-8000-000000009100');

-- The CV / Resume, PSA birth certificate, and 2x2 picture are also required before applying.
insert into public.applicant_profile_documents (applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
select applicant.id, document.kind,
  'applicant-profiles/' || applicant.profile_id || '/' || document.object_id || document.extension,
  document.kind || document.extension, document.mime_type, 1024, applicant.profile_id
from public.applicants applicant
join (values
  ('00000000-0000-4000-8000-000000009102'::uuid, 'resume', '00000000-0000-4000-8000-000000009315', '.pdf', 'application/pdf'),
  ('00000000-0000-4000-8000-000000009102'::uuid, 'psa', '00000000-0000-4000-8000-000000009316', '.pdf', 'application/pdf'),
  ('00000000-0000-4000-8000-000000009102'::uuid, 'photo', '00000000-0000-4000-8000-000000009317', '.png', 'image/png'),
  ('00000000-0000-4000-8000-000000009100'::uuid, 'resume', '00000000-0000-4000-8000-000000009318', '.pdf', 'application/pdf'),
  ('00000000-0000-4000-8000-000000009100'::uuid, 'psa', '00000000-0000-4000-8000-000000009319', '.pdf', 'application/pdf'),
  ('00000000-0000-4000-8000-000000009100'::uuid, 'photo', '00000000-0000-4000-8000-000000009320', '.jpg', 'image/jpeg')
) as document(profile_id, kind, object_id, extension, mime_type) on document.profile_id = applicant.profile_id;

insert into storage.buckets (id, name, public, file_size_limit)
values ('applicant-documents', 'applicant-documents', false, 10485760)
on conflict (id) do nothing;

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000009301',
  'applicant-documents',
  'applicants/00000000-0000-4000-8000-000000009102/00000000-0000-4000-8000-000000009401/00000000-0000-4000-8000-000000009302.pdf',
  '00000000-0000-4000-8000-000000009102',
  '00000000-0000-4000-8000-000000009102',
  '{"mimetype":"application/pdf","size":1024}'::jsonb
);
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000009303',
  'applicant-documents',
  'applicants/00000000-0000-4000-8000-000000009100/00000000-0000-4000-8000-000000009403/00000000-0000-4000-8000-000000009304.docx',
  '00000000-0000-4000-8000-000000009100',
  '00000000-0000-4000-8000-000000009100',
  '{"mimetype":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","size":1024}'::jsonb
);

select extensions.has_function('public', 'submit_application', array['uuid', 'bigint', 'text', 'jsonb'], 'Applicant submission workflow exists');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.lives_ok(
  $$select public.submit_application(
    '00000000-0000-4000-8000-000000009401'::uuid,
    (select id from public.job_openings where status = 'published'),
    'Ready to contribute.',
    '[{"kind":"cv","objectPath":"applicants/00000000-0000-4000-8000-000000009102/00000000-0000-4000-8000-000000009401/00000000-0000-4000-8000-000000009302.pdf","fileName":"cv.pdf","mimeType":"application/pdf","sizeBytes":1024}]'::jsonb
  )$$,
  'Applicant can submit an application with an owned CV'
);
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Submitted', 'Submission starts in Submitted status');
set local role postgres;
select extensions.is(
  (select status from public.application_ai_scores where application_id = '00000000-0000-4000-8000-000000009401'::uuid),
  'queued',
  'Submission queues automatic applicant analysis'
);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009100';
select extensions.throws_ok(
  $$select public.submit_application(
    '00000000-0000-4000-8000-000000009403'::uuid,
    (select id from public.job_openings where status = 'published'),
    'Document validation test.',
    '[{"kind":"cv","objectPath":"applicants/00000000-0000-4000-8000-000000009100/00000000-0000-4000-8000-000000009403/00000000-0000-4000-8000-000000009304.docx","fileName":"cv.docx","mimeType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","sizeBytes":1024}]'::jsonb
  )$$,
  '22023', 'Invalid application document.', 'Application submissions reject Word documents'
);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';

select extensions.has_function('public', 'transition_application_status', array['uuid', 'text', 'text'], 'HR transition workflow exists');
select extensions.has_function('public', 'hire_application', array['uuid', 'text', 'text'], 'Badge-number hiring workflow exists');

select extensions.throws_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Under Review', null)$$,
  '42501', 'HR access is required.', 'Applicants cannot transition their own application'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.lives_ok(
  $$select public.save_job_opening(
    null,
    department.id,
    rank.id,
    'Transactional opening',
    'A job opening created together with its qualification criteria in one transaction.',
    'Headquarters',
    '2026-12-31',
    'closed',
    '[{"ordinal":1,"kind":"experience","requirement":"Two years of relevant experience","isRequired":true}]'::jsonb
  ) from public.departments department
  cross join (select id from public.ranks where code = 'RTR') rank
  where department.name = 'Recruitment test department'$$,
  'HR creates a job opening and criteria through the protected workflow'
);
select extensions.is(
  (select created_by_user_id from public.job_openings where title = 'Transactional opening'),
  '00000000-0000-4000-8000-000000009101'::uuid,
  'The job workflow records its original creator'
);
select extensions.lives_ok(
  $$select public.save_job_opening(
    opening.id,
    opening.department_id,
    opening.rank_id,
    'Transactional opening updated',
    'The edited job opening and its replacement qualification criteria remain consistent.',
    'Headquarters',
    '2026-12-31',
    'closed',
    '[{"ordinal":1,"kind":"experience","requirement":"Three years of relevant experience","isRequired":true},{"ordinal":2,"kind":"skill","requirement":"Clear written communication","isRequired":false}]'::jsonb
  ) from public.job_openings opening where opening.title = 'Transactional opening'$$,
  'HR atomically updates an opening and replaces its criteria'
);
select extensions.is(
  (select created_by_user_id from public.job_openings where title = 'Transactional opening updated'),
  '00000000-0000-4000-8000-000000009101'::uuid,
  'Editing a job opening preserves the original creator'
);
select extensions.is(
  (select count(*) from public.job_qualification_criteria criteria join public.job_openings opening on opening.id = criteria.job_opening_id where opening.title = 'Transactional opening updated'),
  2::bigint,
  'The job workflow replaces criteria as one set'
);
select extensions.throws_ok(
  $$select public.save_job_opening(
    opening.id,
    opening.department_id,
    opening.rank_id,
    'Transactional opening updated',
    'The edited job opening and its replacement qualification criteria remain consistent.',
    'Headquarters',
    '2026-12-31',
    'draft',
    '[{"ordinal":1,"kind":"skill","requirement":"Valid criterion","isRequired":true},{"ordinal":2,"kind":"invalid","requirement":"Invalid criterion","isRequired":true}]'::jsonb
  ) from public.job_openings opening where opening.title = 'Transactional opening updated'$$,
  '22023', null,
  'Invalid replacement criteria reject the entire job update'
);
select extensions.is(
  (select count(*) from public.job_qualification_criteria criteria join public.job_openings opening on opening.id = criteria.job_opening_id where opening.title = 'Transactional opening updated'),
  2::bigint,
  'A failed criteria replacement leaves the existing set intact'
);
select extensions.is(
  (select status from public.job_openings where title = 'Transactional opening updated'),
  'closed',
  'The atomic job workflow leaves a valid opening state after a failed retry'
);
select extensions.lives_ok(
  $$select public.save_job_opening(
    null, null, null,
    'Opening without department or rank',
    'Job postings no longer need a department or a rank to be saved by HR.',
    'Headquarters',
    '2026-12-31',
    'closed',
    '[{"ordinal":1,"kind":"skill","requirement":"Clear written communication","isRequired":true}]'::jsonb
  )$$,
  'HR saves a job posting without a department or rank'
);
select extensions.throws_ok(
  $$select public.save_job_opening(
    null, null, null,
    'Opening without a deadline',
    'Job postings must carry a location and a deadline of application.',
    'Headquarters',
    null,
    'draft',
    '[{"ordinal":1,"kind":"skill","requirement":"Clear written communication","isRequired":true}]'::jsonb
  )$$,
  '22023', 'Job opening details are invalid.',
  'A job posting requires a deadline of application'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Under Review', 'Initial review started')$$,
  'HR can move Submitted to Under Review'
);
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Under Review', 'Review transition persists');

set local role postgres;
select extensions.throws_ok(
  $$insert into public.application_ai_scores (
      application_id, requested_by_user_id, status, score, explanation,
      provider, model, model_version, input_at, completed_at
    ) values (
      '00000000-0000-4000-8000-000000009401',
      '00000000-0000-4000-8000-000000009101',
      'completed', 101, 'Score exceeds the permitted range.',
      'gemini', 'gemini-2.5-flash-lite', '2026-08', now(), now()
    )$$,
  '23514', null, 'AI scores reject values above 100'
);

insert into public.applications (id, applicant_id, job_opening_id, status)
select
  '00000000-0000-4000-8000-000000009402',
  applicant.id,
  opening.id,
  'Submitted'
from public.applicants applicant
join public.job_openings opening on opening.status = 'draft'
where applicant.profile_id = '00000000-0000-4000-8000-000000009102';

update public.application_ai_scores set status = 'processing', processing_started_at = clock_timestamp()
where application_id = '00000000-0000-4000-8000-000000009401';
select extensions.lives_ok(
  $$select public.complete_application_analysis(
    (select id from public.application_ai_scores where application_id = '00000000-0000-4000-8000-000000009401'::uuid),
    72,
    'Matches core education and experience criteria.',
    'gemini',
    'gemini-2.5-flash-lite',
    '2026-08',
    clock_timestamp()
  )$$,
  'Worker completion persists the score and audit atomically'
);
select extensions.ok(
  exists (select 1 from public.audit_logs where entity_type = 'applications' and entity_id = '00000000-0000-4000-8000-000000009401' and action = 'ai_scored'),
  'Atomic analysis completion writes its audit record'
);

insert into public.application_ai_scores (
  application_id, requested_by_user_id, status, score, explanation,
  provider, model, model_version, input_at, completed_at
) values (
    '00000000-0000-4000-8000-000000009402',
    '00000000-0000-4000-8000-000000009101',
    'completed', 88, 'Matches required skills and preferred certification.',
    'gemini', 'gemini-2.5-flash-lite', '2026-08', now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.is((select count(*) from public.application_ai_scores), 2::bigint, 'HR can read AI score recommendations');
select extensions.is(
  (
    select array_agg(application_id order by ai_score desc)
    from public.list_hr_application_shortlist(null, 'completed', null)
  ),
  array[
    '00000000-0000-4000-8000-000000009402'::uuid,
    '00000000-0000-4000-8000-000000009401'::uuid
  ],
  'HR shortlist ranks completed recommendations by score'
);
select extensions.is(
  (select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid),
  'Under Review',
  'AI scoring does not change the application status'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.is((select count(*) from public.application_ai_scores), 0::bigint, 'Applicants cannot read AI score recommendations');
select extensions.throws_ok(
  $$insert into public.application_ai_scores (application_id, requested_by_user_id, status)
    values (
      '00000000-0000-4000-8000-000000009401',
      '00000000-0000-4000-8000-000000009102',
      'pending'
    )$$,
  '42501', null, 'Applicants cannot write AI score recommendations'
);
select extensions.throws_ok(
  $$select public.retry_application_analysis('00000000-0000-4000-8000-000000009401'::uuid)$$,
  '42501', null, 'Applicants cannot retry application analysis'
);

set local role postgres;
update public.application_ai_scores
set status = 'failed',
    score = null,
    explanation = null,
    provider = null,
    model = null,
    model_version = null,
    failure_code = 'provider_unavailable',
    completed_at = clock_timestamp()
where application_id = '00000000-0000-4000-8000-000000009401';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.lives_ok(
  $$select public.retry_application_analysis('00000000-0000-4000-8000-000000009401'::uuid)$$,
  'HR can queue a fresh attempt after terminal analysis failure'
);
select extensions.throws_ok(
  $$select public.retry_application_analysis('00000000-0000-4000-8000-000000009401'::uuid)$$,
  'P0001', 'Analysis can be retried only after it has failed.', 'An active retry cannot be queued twice'
);
set local role postgres;
select extensions.is(
  (select status from public.application_ai_scores where application_id = '00000000-0000-4000-8000-000000009401'::uuid order by created_at desc, id desc limit 1),
  'queued',
  'HR retry creates a queued analysis attempt'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Shortlisted', 'Meets the required criteria')$$,
  'HR can shortlist an application under review'
);
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Shortlisted', 'Shortlist transition persists');
select extensions.throws_ok(
  $$select public.hire_application('00000000-0000-4000-8000-000000009401'::uuid, 'EMP-2026-001', null)$$,
  '22023', 'Only applicants endorsed for training can be hired.', 'Hiring waits until the end of the cycle'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Interview', null)$$,
  'HR can set an application for interview'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Endorsed to Crame', null)$$,
  'HR can endorse an interviewed applicant to Crame'
);
select extensions.throws_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Neuro Exam', null)$$,
  '22023', 'The applicant has not uploaded proof of passing the BMI yet.', 'The neuro exam waits for the BMI proof'
);
select extensions.lives_ok(
  $$select public.add_application_remark('00000000-0000-4000-8000-000000009401'::uuid, 'Passed the BMI at Crame.')$$,
  'HR can add a progress remark'
);
-- Stand in for the applicant's uploaded BMI proof, then finish the cycle.
insert into public.applicant_documents (application_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
select '00000000-0000-4000-8000-000000009401'::uuid, 'bmi_proof', 'applicants/test/bmi.pdf', 'bmi.pdf', 'application/pdf', 10, uploaded_by_user_id
from public.applicant_documents where application_id = '00000000-0000-4000-8000-000000009401'::uuid limit 1;
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Neuro Exam', null)$$,
  'HR can move an applicant with BMI proof to the neuro exam'
);
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'For Training', null)$$,
  'HR can endorse an applicant for training'
);

select extensions.lives_ok(
  $$select public.hire_application(
    '00000000-0000-4000-8000-000000009401'::uuid,
    'EMP-2026-001',
    'Selected after a successful interview.'
  )$$,
  'HR hiring creates the employee and pending activation request atomically'
);
set local role postgres;
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Hired', 'Hiring persists the terminal application status');
select extensions.is(
  (select profile_id from public.employees employee join public.applications application on application.hired_employee_id = employee.id where application.id = '00000000-0000-4000-8000-000000009401'::uuid),
  '00000000-0000-4000-8000-000000009102'::uuid,
  'Hired employee links the applicant account'
);
select extensions.is((select status from public.employee_activation_requests where application_id = '00000000-0000-4000-8000-000000009401'::uuid), 'pending', 'Hiring creates a pending activation request');
select extensions.is((select role from public.user_roles where user_id = '00000000-0000-4000-8000-000000009102'::uuid), 'applicant'::public.app_role, 'Hiring does not grant the Employee role');
select extensions.ok(exists (
  select 1 from public.audit_logs
  where actor_user_id = '00000000-0000-4000-8000-000000009101'::uuid
    and entity_type = 'applications'
    and entity_id = '00000000-0000-4000-8000-000000009401'
    and action = 'hired'
), 'Hiring writes an audit record');
select extensions.is(
  (select rank.code from public.employees employee join public.ranks rank on rank.id = employee.rank_id
    join public.applications application on application.hired_employee_id = employee.id
    where application.id = '00000000-0000-4000-8000-000000009401'::uuid),
  'PAT', 'Hiring assigns the Patrolman / Patrolwoman rank looked up by its code');
select extensions.is(
  (select employee.department_id from public.employees employee
    join public.applications application on application.hired_employee_id = employee.id
    join public.job_openings opening on opening.id = application.job_opening_id
    where application.id = '00000000-0000-4000-8000-000000009401'::uuid),
  (select opening.department_id from public.applications application
    join public.job_openings opening on opening.id = application.job_opening_id
    where application.id = '00000000-0000-4000-8000-000000009401'::uuid),
  'Hiring places the new employee in the department of the job they applied for');

-- Applicants keep seeing the job they applied for after it stops being published.
insert into public.job_qualification_criteria (job_opening_id, ordinal, kind, requirement)
select job_opening_id, 1, 'skill', 'Clear written communication' from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid;
update public.job_openings set status = 'closed', published_at = null
where id = (select job_opening_id from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.is(
  (select count(*) from public.job_openings opening join public.applications application on application.job_opening_id = opening.id
    where application.id = '00000000-0000-4000-8000-000000009401'::uuid),
  1::bigint, 'The applicant still sees a closed job they applied to');
select extensions.cmp_ok(
  (select count(*) from public.job_qualification_criteria criteria join public.applications application on application.job_opening_id = criteria.job_opening_id
    where application.id = '00000000-0000-4000-8000-000000009401'::uuid),
  '>', 0::bigint, 'The applicant still sees the criteria of a closed job they applied to');
set local role postgres;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009103';
select extensions.lives_ok(
  $$select public.update_managed_user('00000000-0000-4000-8000-000000009102'::uuid, 'employee'::public.app_role, true)$$,
  'Administrator activates the hired applicant through the existing workflow'
);
select extensions.is((select status from public.employee_activation_requests where application_id = '00000000-0000-4000-8000-000000009401'::uuid), 'activated', 'Administrator activation completes the pending request');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.lives_ok(
  $$insert into public.job_openings (department_id, rank_id, title, description, created_by_user_id)
    select department.id, rank.id, 'HR created opening', 'An opening created directly by authorized Human Resources personnel.', '00000000-0000-4000-8000-000000009101'::uuid
    from public.departments department cross join (select id from public.ranks where code = 'RTR') rank
    where department.name = 'Recruitment test department'$$,
  'HR can create a draft job opening'
);
select extensions.lives_ok(
  $$insert into public.job_qualification_criteria (job_opening_id, ordinal, kind, requirement)
    select id, 1, 'experience', 'Two years of related experience'
    from public.job_openings where title = 'HR created opening'$$,
  'HR can create qualification criteria'
);
select extensions.lives_ok(
  $$update public.job_openings set status = 'published', published_at = now() where title = 'HR created opening'$$,
  'HR can publish an opening'
);
select extensions.throws_ok(
  $$delete from public.job_openings where title = 'HR created opening'$$,
  '42501', null, 'HR cannot hard-delete job openings'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.throws_ok(
  $$insert into public.job_openings (department_id, rank_id, title, description, created_by_user_id)
    select department.id, rank.id, 'Applicant created opening', 'An unauthorized opening attempt by an applicant account.', '00000000-0000-4000-8000-000000009102'::uuid
    from public.departments department cross join (select id from public.ranks where code = 'RTR') rank
    where department.name = 'Recruitment test department'$$,
  '42501', null, 'Applicants cannot create job openings'
);
-- Job posting images: optional public image per posting, managed only by HR.
set local role postgres;
select extensions.has_column('public', 'job_openings', 'image_path', 'Job openings can carry an optional image path');
select extensions.ok(
  exists (select 1 from storage.buckets where id = 'job-posting-images' and public and file_size_limit = 5242880 and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']),
  'Job posting images use a public-read bucket limited to 5 MiB PNG, JPEG, or WebP images'
);
select extensions.has_function('public', 'set_job_opening_image', array['bigint', 'text'], 'HR job posting image workflow exists');
select extensions.ok(has_column_privilege('anon', 'public.job_openings', 'image_path', 'select'), 'Public visitors can read a posting image path');
insert into storage.objects (bucket_id, name)
select 'job-posting-images', 'job-openings/' || id || '/0b8f2c1e-1111-4222-8333-944455556666.png' from public.job_openings where title = 'Transactional opening updated';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.throws_ok(
  $$select public.set_job_opening_image(id, 'job-openings/' || id || '/0b8f2c1e-1111-4222-8333-944455556666.png') from public.job_openings where status = 'published' limit 1$$,
  '42501', 'Human Resources access is required.', 'Applicants cannot set a job posting image'
);
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('job-posting-images', 'job-openings/1/1b8f2c1e-1111-4222-8333-944455556666.png')$$,
  '42501', null, 'Applicants cannot upload job posting images'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.throws_ok(
  $$select public.set_job_opening_image(id, 'job-openings/0/0b8f2c1e-1111-4222-8333-944455556666.png') from public.job_openings where title = 'Transactional opening updated'$$,
  '22023', 'Job posting image is invalid.', 'An image path must belong to its job opening'
);
select extensions.throws_ok(
  $$select public.set_job_opening_image(id, 'job-openings/' || id || '/2b8f2c1e-1111-4222-8333-944455556666.png') from public.job_openings where title = 'Transactional opening updated'$$,
  '22023', 'Upload the job posting image before saving it.', 'An image path must point to an uploaded object'
);
select extensions.lives_ok(
  $$select public.set_job_opening_image(id, 'job-openings/' || id || '/0b8f2c1e-1111-4222-8333-944455556666.png') from public.job_openings where title = 'Transactional opening updated'$$,
  'HR sets a job posting image'
);
select extensions.is(
  (select image_path from public.job_openings where title = 'Transactional opening updated'),
  (select 'job-openings/' || id || '/0b8f2c1e-1111-4222-8333-944455556666.png' from public.job_openings where title = 'Transactional opening updated'),
  'The job opening stores its image path'
);
select extensions.is(
  (select public.set_job_opening_image(id, null) from public.job_openings where title = 'Transactional opening updated'),
  (select 'job-openings/' || id || '/0b8f2c1e-1111-4222-8333-944455556666.png' from public.job_openings where title = 'Transactional opening updated'),
  'Removing a job posting image returns the previous path for cleanup'
);

select * from extensions.finish();
rollback;
