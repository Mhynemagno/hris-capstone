begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(11);

select extensions.has_column('public', 'certifications', 'document_path', 'Certification / Training keeps a document');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000003101', 'authenticated', 'authenticated', 'cert-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003102', 'authenticated', 'authenticated', 'cert-hr2@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003103', 'authenticated', 'authenticated', 'cert-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000003104', 'authenticated', 'authenticated', 'cert-other@example.test', now(), now());
update public.user_roles set role = case
    when user_id in ('00000000-0000-4000-8000-000000003101'::uuid, '00000000-0000-4000-8000-000000003102'::uuid) then 'hr_personnel'::public.app_role
    else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000003101'::uuid, '00000000-0000-4000-8000-000000003102'::uuid, '00000000-0000-4000-8000-000000003103'::uuid, '00000000-0000-4000-8000-000000003104'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on, gender)
values
  ('00000000-0000-4000-8000-000000003111', '00000000-0000-4000-8000-000000003103', 'CRT-001', 'Cert', 'Officer', 'cert-employee@example.test', '2024-01-01', 'female'),
  ('00000000-0000-4000-8000-000000003112', '00000000-0000-4000-8000-000000003104', 'CRT-002', 'Other', 'Officer', 'cert-other@example.test', '2024-01-01', 'male');

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata) values
  ('00000000-0000-4000-8000-000000003181', 'personnel-documents', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', '00000000-0000-4000-8000-000000003101', '00000000-0000-4000-8000-000000003101', '{"mimetype":"application/pdf","size":100}'::jsonb);

select extensions.throws_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name)
    values ('00000000-0000-4000-8000-000000003111', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', 'psbrc.pdf')$$,
  '23514', null, 'A certification document needs all four document fields'
);
select extensions.throws_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000003111', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/missing.pdf', 'missing.pdf', 'application/pdf', 100)$$,
  '22023', 'The supporting document was not uploaded.', 'The document must exist in storage'
);
select extensions.throws_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000003112', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', 'psbrc.pdf', 'application/pdf', 100)$$,
  '22023', 'The supporting document was not uploaded.', 'The document must sit in the same employee''s folder'
);
select extensions.lives_ok(
  $$insert into public.certifications (employee_id, name, issued_on, document_path, document_name, document_mime_type, document_size_bytes)
    values ('00000000-0000-4000-8000-000000003111', 'Public Safety Basic Recruit Course (PSBRC)', '2016-03-14', 'certifications/00000000-0000-4000-8000-000000003111/psbrc.pdf', 'psbrc.pdf', 'application/pdf', 100)$$,
  'A certification is saved with its document'
);
select extensions.lives_ok(
  $$insert into public.certifications (employee_id, name, issued_on) values ('00000000-0000-4000-8000-000000003111', 'Criminal Investigation Course (CIC)', '2018-05-01')$$,
  'A certification without a document is still valid'
);

-- Storage policies, exercised as real users.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003101';
select extensions.lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('personnel-documents', 'certifications/00000000-0000-4000-8000-000000003111/cic.pdf', '00000000-0000-4000-8000-000000003101')$$,
  'HR uploads a certification document'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003103';
select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('personnel-documents', 'certifications/00000000-0000-4000-8000-000000003111/self.pdf', '00000000-0000-4000-8000-000000003103')$$,
  '42501', null, 'An employee cannot upload certification documents'
);
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'personnel-documents' and name like 'certifications/00000000-0000-4000-8000-000000003111/%'),
  2::bigint, 'The employee can read their own certification documents'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003104';
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'personnel-documents'),
  0::bigint, 'Another employee cannot see them'
);

-- Direct SQL deletes are blocked by Supabase Storage; its API deletes under these policies.
set local role postgres;
select extensions.is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE' and policyname = 'personnel_documents_delete_hr'),
  1::bigint, 'Any HR user can remove personnel documents (Replace / Remove across HR users)'
);

select * from extensions.finish();

rollback;
