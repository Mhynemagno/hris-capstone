begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(33);

insert into auth.users (id, aud, role, email, created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000015001', 'authenticated', 'authenticated', 'portal-applicant@example.test', now(), now(),
    '{"first_name":"Juan","last_name":"Dela Cruz","middle_name":"Santos","qualifier":"Jr.","phone":"+639171234567","date_of_birth":"1998-04-12","full_name":"Juan Dela Cruz"}'::jsonb),
  ('00000000-0000-4000-8000-000000015002', 'authenticated', 'authenticated', 'portal-messy@example.test', now(), now(),
    '{"first_name":"Ana","last_name":"Reyes","middle_name":"  ","qualifier":"Sr.","phone":"0917","date_of_birth":"2020-02-31"}'::jsonb),
  ('00000000-0000-4000-8000-000000015003', 'authenticated', 'authenticated', 'portal-hr@example.test', now(), now(), '{}'::jsonb);

update public.user_roles set role = 'hr_personnel'::public.app_role
where user_id = '00000000-0000-4000-8000-000000015003'::uuid;

-- Registration details are copied from sign-up metadata into the applicant profile.
select extensions.is(
  (select row(middle_name, qualifier, phone, date_of_birth)::text from public.applicants where profile_id = '00000000-0000-4000-8000-000000015001'::uuid),
  row('Santos', 'Jr.', '+639171234567', '1998-04-12'::date)::text,
  'Registration stores the middle name, qualifier, mobile number, and birthdate'
);
select extensions.is(
  (select row(first_name, middle_name, qualifier, phone, date_of_birth)::text from public.applicants where profile_id = '00000000-0000-4000-8000-000000015002'::uuid),
  row('Ana', null::text, null::text, null::text, null::date)::text,
  'Malformed registration details are stored as empty instead of blocking the sign-up'
);

-- II. Educational Background storage.
select extensions.has_table('public', 'applicant_education', 'Applicant educational background table exists');
select extensions.col_is_unique('public', 'applicant_education', array['applicant_id', 'level'], 'One education row per level per applicant');
select extensions.throws_ok(
  $$insert into public.applicant_education (applicant_id, level) select id, 'doctorate' from public.applicants where profile_id = '00000000-0000-4000-8000-000000015001'$$,
  '23514', null, 'Education levels are limited to Primary (elementary), Secondary, Bachelor''s Degree (college), and Graduate Degree'
);
select extensions.has_column('public', 'applicant_education', 'location', 'Each education level records the school location');
select extensions.has_column('public', 'applicants', 'citizenship', 'Applicants record their citizenship');

do $$ begin perform set_config('test.other_applicant_id', (select id::text from public.applicants where profile_id = '00000000-0000-4000-8000-000000015002'), true); end $$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015001';
select extensions.lives_ok(
  $$insert into public.applicant_education (applicant_id, level, school_name, degree_course, year_graduated, location)
    select id, 'college', 'Polytechnic University of the Philippines', 'BS Criminology', 2020, 'Manila' from public.applicants$$,
  'An applicant can add their own education row'
);
select extensions.lives_ok(
  $$insert into public.applicant_education (applicant_id, level, school_name, degree_course, year_graduated, location)
    select id, 'graduate', 'University of the Philippines', 'MA Public Administration', 2023, 'Quezon City' from public.applicants$$,
  'An applicant can add an optional Graduate Degree'
);
select extensions.lives_ok(
  $$update public.applicants set citizenship = 'Filipino'$$,
  'An applicant can save their citizenship'
);
select extensions.is((select citizenship from public.applicants), 'Filipino', 'The citizenship is saved');
select extensions.lives_ok(
  $$update public.applicant_education set year_graduated = 2021 where level = 'college'$$,
  'An applicant can update their own education row'
);
select extensions.is((select row(year_graduated, location)::text from public.applicant_education where level = 'college'), row(2021::smallint, 'Manila')::text, 'The update is saved');
select extensions.throws_ok(
  $$insert into public.applicant_education (applicant_id, level, school_name)
    values (current_setting('test.other_applicant_id')::uuid, 'elementary', 'Someone else')$$,
  '42501', null, 'An applicant cannot add education rows to another applicant'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015002';
select extensions.is((select count(*) from public.applicant_education), 0::bigint, 'Applicants cannot read another applicant''s education');
update public.applicant_education set school_name = 'Tampered';

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015003';
select extensions.is(
  (select school_name from public.applicant_education education join public.applicants applicant on applicant.id = education.applicant_id where applicant.profile_id = '00000000-0000-4000-8000-000000015001' and education.level = 'college'),
  'Polytechnic University of the Philippines',
  'HR can read applicant education and other applicants could not change it'
);
select extensions.throws_ok(
  $$insert into public.applicant_education (applicant_id, level) select id, 'secondary' from public.applicants where profile_id = '00000000-0000-4000-8000-000000015001'$$,
  '42501', null, 'HR has read-only access to applicant education'
);

-- HR sees every registered applicant account, including those without an application.
select extensions.is(
  (select row(email, phone, application_count, latest_application_status)::text from public.list_hr_registered_applicants() where user_id = '00000000-0000-4000-8000-000000015001'),
  row('portal-applicant@example.test', '+639171234567', 0::bigint, null::text)::text,
  'HR sees a registered applicant who has not applied yet'
);
select extensions.is(
  (select count(*) from public.list_hr_registered_applicants() where user_id = '00000000-0000-4000-8000-000000015003'),
  0::bigint,
  'The applicant directory lists only applicant accounts'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015001';
select extensions.throws_ok($$select * from public.list_hr_registered_applicants()$$, '42501', null, 'Applicants cannot list other applicant accounts');

set local role anon;
select extensions.throws_ok($$select * from public.list_hr_registered_applicants()$$, '42501', null, 'Anonymous visitors cannot call the applicant directory');

-- Removing required profile documents.
set local role postgres;
insert into public.applicant_profile_documents (applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
select applicant.id, document.kind, 'applicant-profiles/00000000-0000-4000-8000-000000015001/' || document.object_id || '.pdf', document.kind || '.pdf', 'application/pdf', 1024, applicant.profile_id
from public.applicants applicant
cross join (values ('eligibility', '00000000-0000-4000-8000-000000015101'), ('diploma', '00000000-0000-4000-8000-000000015102')) as document(kind, object_id)
where applicant.profile_id = '00000000-0000-4000-8000-000000015001';

select extensions.throws_ok(
  $$insert into public.applicant_profile_documents (applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    select id, 'photo', 'applicant-profiles/00000000-0000-4000-8000-000000015001/00000000-0000-4000-8000-000000015103.pdf', 'photo.pdf', 'application/pdf', 1024, profile_id
    from public.applicants where profile_id = '00000000-0000-4000-8000-000000015001'$$,
  '23514', null, 'The 2x2 picture must be a PNG or JPEG image'
);
select extensions.lives_ok(
  $$insert into public.applicant_profile_documents (applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    select id, 'psa', 'applicant-profiles/00000000-0000-4000-8000-000000015001/00000000-0000-4000-8000-000000015104.pdf', 'psa.pdf', 'application/pdf', 1024, profile_id
    from public.applicants where profile_id = '00000000-0000-4000-8000-000000015001'$$,
  'The PSA birth certificate is an applicant profile document'
);

insert into public.job_openings (title, description, status, published_at, created_by_user_id)
values ('Portal feedback opening', 'An opening used by the applicant portal feedback tests.', 'published', now(), '00000000-0000-4000-8000-000000015003');

insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000015201', applicant.id, opening.id, 'Panel Interview'
from public.applicants applicant cross join public.job_openings opening
where applicant.profile_id = '00000000-0000-4000-8000-000000015001' and opening.title = 'Portal feedback opening';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015003';
select extensions.is(
  (select row(application_count, latest_application_status, latest_job_title)::text from public.list_hr_registered_applicants() where user_id = '00000000-0000-4000-8000-000000015001'),
  row(1::bigint, 'Panel Interview', 'Portal feedback opening')::text,
  'The applicant directory shows the latest application status'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015001';
select extensions.throws_ok(
  $$select public.submit_application(
    '00000000-0000-4000-8000-000000015202'::uuid,
    (select id from public.job_openings where title = 'Portal feedback opening'),
    null,
    '[]'::jsonb
  )$$,
  '42501', 'Upload your eligibility, diploma, CV / resume, PSA birth certificate, and 2x2 picture before applying.',
  'Applying requires all five profile documents, not only Eligibility and Diploma'
);
select extensions.throws_ok(
  $$select public.remove_my_applicant_profile_document('diploma')$$,
  'P0001', null, 'Required documents cannot be removed while an application is being decided'
);
select extensions.throws_ok(
  $$select public.remove_my_applicant_profile_document('passport')$$,
  '22023', null, 'Only the required profile document kinds can be removed'
);

set local role postgres;
update public.applications set status = 'Not Selected' where id = '00000000-0000-4000-8000-000000015201';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015001';
select extensions.is(
  public.remove_my_applicant_profile_document('diploma'),
  'applicant-profiles/00000000-0000-4000-8000-000000015001/00000000-0000-4000-8000-000000015102.pdf',
  'An applicant can remove a document once no application is in progress, and gets its storage path back'
);
select extensions.is((select array_agg(kind order by kind) from public.applicant_profile_documents), array['eligibility', 'psa'], 'Only the removed document is gone');
select extensions.is(
  public.remove_my_applicant_profile_document('psa'),
  'applicant-profiles/00000000-0000-4000-8000-000000015001/00000000-0000-4000-8000-000000015104.pdf',
  'An applicant can remove one of the new required documents'
);
select extensions.throws_ok(
  $$select public.remove_my_applicant_profile_document('diploma')$$,
  'P0002', null, 'Removing a missing document reports that it was not found'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015003';
select extensions.throws_ok(
  $$select public.remove_my_applicant_profile_document('eligibility')$$,
  '42501', null, 'Non-applicants cannot remove applicant documents'
);

set local role anon;
select extensions.throws_ok(
  $$select public.remove_my_applicant_profile_document('eligibility')$$,
  '42501', null, 'Anonymous visitors cannot call the removal RPC'
);

select * from extensions.finish();
rollback;
