begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(7);

insert into auth.users (id, aud, role, email, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000016001', 'authenticated', 'authenticated', 'pdf-only-applicant@example.test', now(), now(),
  '{"first_name":"Pia","last_name":"Dokumento","phone":"+639171234500","date_of_birth":"1999-01-02","full_name":"Pia Dokumento"}'::jsonb);

-- Registration creates the applicant row (see applicant_portal_feedback.test.sql); every later assertion depends on it.
select extensions.is((select count(*) from public.applicants where profile_id = '00000000-0000-4000-8000-000000016001'), 1::bigint, 'The fixture applicant exists');

insert into storage.objects (bucket_id, name, owner_id)
values
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/11111111-1111-4111-8111-111111111111.png', '00000000-0000-4000-8000-000000016001'),
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/22222222-2222-4222-8222-222222222222.pdf', '00000000-0000-4000-8000-000000016001'),
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/33333333-3333-4333-8333-333333333333.png', '00000000-0000-4000-8000-000000016001'),
  ('applicant-profile-documents', 'applicant-profiles/00000000-0000-4000-8000-000000016001/44444444-4444-4444-8444-444444444444.pdf', '00000000-0000-4000-8000-000000016001');

select extensions.is(
  (select convalidated from pg_constraint where conname = 'applicant_profile_documents_non_photo_is_pdf'),
  false,
  'The PDF-only constraint does not re-check documents uploaded before the rule'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000016001';

select extensions.throws_ok(
  $$ select public.save_my_applicant_profile_document('resume', 'applicant-profiles/00000000-0000-4000-8000-000000016001/11111111-1111-4111-8111-111111111111.png', 'cv.png', 'image/png', 100) $$,
  '22023', 'Upload the CV / Resume as a PDF file.', 'A CV image is rejected'
);
select extensions.lives_ok(
  $$ select public.save_my_applicant_profile_document('resume', 'applicant-profiles/00000000-0000-4000-8000-000000016001/22222222-2222-4222-8222-222222222222.pdf', 'cv.pdf', 'application/pdf', 100) $$,
  'A CV PDF is saved'
);
select extensions.lives_ok(
  $$ select public.save_my_applicant_profile_document('photo', 'applicant-profiles/00000000-0000-4000-8000-000000016001/33333333-3333-4333-8333-333333333333.png', 'photo.png', 'image/png', 100) $$,
  'The 2x2 picture is still saved as an image'
);
select extensions.throws_ok(
  $$ select public.save_my_applicant_profile_document('photo', 'applicant-profiles/00000000-0000-4000-8000-000000016001/44444444-4444-4444-8444-444444444444.pdf', 'photo.pdf', 'application/pdf', 100) $$,
  '22023', null, 'The 2x2 picture still cannot be a PDF'
);

set local role postgres;
select extensions.throws_ok(
  $$ insert into public.applicant_profile_documents (applicant_id, kind, object_path, file_name, mime_type, size_bytes)
     select id, 'psa', 'applicant-profiles/00000000-0000-4000-8000-000000016001/11111111-1111-4111-8111-111111111111.png', 'psa.png', 'image/png', 100
     from public.applicants where profile_id = '00000000-0000-4000-8000-000000016001' $$,
  '23514', null, 'New non-photo documents must be PDFs even when written directly'
);

select * from extensions.finish();
rollback;
