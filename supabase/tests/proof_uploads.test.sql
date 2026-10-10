begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(17);

select extensions.has_column('public', 'qualifications', 'document_path', 'Eligibility keeps a supporting document');
select extensions.has_table('public', 'deployment_reports', 'Deployments keep reports / proof of attendance');
select extensions.has_function('public', 'submit_deployment_report', array['uuid', 'text', 'jsonb'], 'A report can be submitted for a deployment');
select extensions.is((select requires_attachment from public.leave_types where lower(name) = 'sick leave'), true, 'Sick Leave requires a supporting document');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002701', 'authenticated', 'authenticated', 'proof-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002702', 'authenticated', 'authenticated', 'proof-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002703', 'authenticated', 'authenticated', 'proof-other@example.test', now(), now());
update public.user_roles set role = case user_id when '00000000-0000-4000-8000-000000002701'::uuid then 'hr_personnel'::public.app_role else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000002701'::uuid, '00000000-0000-4000-8000-000000002702'::uuid, '00000000-0000-4000-8000-000000002703'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on, gender)
values
  ('00000000-0000-4000-8000-000000002711', '00000000-0000-4000-8000-000000002702', 'PRF-001', 'Proof', 'Officer', 'proof-employee@example.test', '2024-01-01', 'female'),
  ('00000000-0000-4000-8000-000000002712', '00000000-0000-4000-8000-000000002703', 'PRF-002', 'Other', 'Officer', 'proof-other@example.test', '2024-01-01', 'male');

insert into public.deployments (id, employee_id, location, assignment_role, starts_on, status, notes, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000002791', '00000000-0000-4000-8000-000000002711', 'Plaza', 'Plaza', '2099-04-01', 'scheduled', 'Fiesta', '00000000-0000-4000-8000-000000002701', '00000000-0000-4000-8000-000000002701');

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata) values
  ('00000000-0000-4000-8000-000000002781', 'deployment-reports', 'deployments/00000000-0000-4000-8000-000000002791/report.pdf', '00000000-0000-4000-8000-000000002702', '00000000-0000-4000-8000-000000002702', '{"mimetype":"application/pdf","size":100}'::jsonb),
  ('00000000-0000-4000-8000-000000002782', 'personnel-documents', 'qualifications/00000000-0000-4000-8000-000000002711/csc.pdf', '00000000-0000-4000-8000-000000002701', '00000000-0000-4000-8000-000000002701', '{"mimetype":"application/pdf","size":100}'::jsonb);

-- The employee who was deployed submits proof that they went.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002702';
select extensions.lives_ok(
  $$select public.submit_deployment_report('00000000-0000-4000-8000-000000002791', 'Attended the whole event',
      '{"objectPath":"deployments/00000000-0000-4000-8000-000000002791/report.pdf","fileName":"report.pdf","mimeType":"application/pdf","sizeBytes":100}'::jsonb)$$,
  'The deployed employee submits a report with proof'
);
select extensions.throws_ok(
  $$select public.submit_deployment_report('00000000-0000-4000-8000-000000002791', 'No file', null)$$,
  '22023', 'Attach the report or proof of attendance.', 'A report needs a document'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002703';
select extensions.throws_ok(
  $$select public.submit_deployment_report('00000000-0000-4000-8000-000000002791', 'Not mine',
      '{"objectPath":"deployments/00000000-0000-4000-8000-000000002791/report.pdf","fileName":"report.pdf","mimeType":"application/pdf","sizeBytes":100}'::jsonb)$$,
  '42501', null, 'Another employee cannot report on someone else''s deployment'
);
select extensions.is((select count(*) from public.deployment_reports), 0::bigint, 'Another employee cannot read the report');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002701';
select extensions.is((select file_name from public.deployment_reports where deployment_id = '00000000-0000-4000-8000-000000002791'), 'report.pdf', 'HR sees the submitted report');

select extensions.throws_ok(
  $$insert into public.qualifications (employee_id, name, awarded_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000002711', 'Civil Service Professional Examination', '2015-12-10', 'qualifications/00000000-0000-4000-8000-000000002711/missing.pdf', 'missing.pdf', 'application/pdf', 100)$$,
  '22023', 'The supporting document was not uploaded.', 'An eligibility document must exist in storage'
);
select extensions.lives_ok(
  $$insert into public.qualifications (employee_id, name, awarded_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000002711', 'Civil Service Professional Examination', '2015-12-10', 'qualifications/00000000-0000-4000-8000-000000002711/csc.pdf', 'csc.pdf', 'application/pdf', 100)$$,
  'HR records eligibility with its supporting document'
);

-- Sick leave needs a supporting document (checked when the request is saved).
set constraints all immediate;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002702';
select extensions.throws_ok(
  $$select public.submit_leave_request('00000000-0000-4000-8000-000000002741'::uuid,
      (select id from public.leave_types where lower(name) = 'sick leave'), current_date + 5, current_date + 6, 'Flu', '[]'::jsonb)$$,
  '22023', 'Attach a supporting document for Sick Leave.', 'Sick leave without a document is rejected'
);

-- Storage policies, exercised as real users.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002702';
select extensions.lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('deployment-reports', 'deployments/00000000-0000-4000-8000-000000002791/mine.pdf', '00000000-0000-4000-8000-000000002702')$$,
  'The deployed employee can upload into their own deployment folder'
);
-- Direct SQL deletes are blocked by Supabase Storage; its API deletes under these uploader-only policies.
select extensions.is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
     and policyname in ('deployment_reports_delete_own_upload', 'personnel_documents_delete_own_upload', 'recruitment_stage_documents_delete_own_upload')),
  3::bigint, 'Uploaders can remove their own failed uploads in all three buckets'
);
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('personnel-documents', 'qualifications/00000000-0000-4000-8000-000000002711/self.pdf', '00000000-0000-4000-8000-000000002702')$$,
  '42501', null, 'An employee cannot upload eligibility documents'
);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002703';
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('deployment-reports', 'deployments/00000000-0000-4000-8000-000000002791/not-mine.pdf', '00000000-0000-4000-8000-000000002703')$$,
  '42501', null, 'Another employee cannot upload into someone else''s deployment folder'
);
select extensions.is(
  (select count(*) from storage.objects where bucket_id in ('deployment-reports', 'personnel-documents')),
  0::bigint, 'Another employee cannot see someone else''s reports or eligibility documents'
);

select * from extensions.finish();

rollback;
