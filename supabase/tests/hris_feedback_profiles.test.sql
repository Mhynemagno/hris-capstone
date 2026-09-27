begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(13);

select extensions.has_column(
  'public',
  'applicants',
  'applicant_number',
  'Applicant profiles receive a permanent generated number'
);
select extensions.has_function(
  'public',
  'format_applicant_number',
  array['bigint'],
  'Applicant-number formatter exists'
);
select extensions.has_table(
  'public',
  'applicant_profile_documents',
  'Eligibility and Diploma metadata is stored separately from applications'
);
select extensions.hasnt_sequence('public', 'applicant_number_seq', 'The global applicant-number sequence is replaced by per-year counters');
select extensions.is(public.format_applicant_number(202601), '2-02601', 'The first applicant of 2026 reads 2-02601');
select extensions.is(public.format_applicant_number(2026100), '2-026100', 'The hundredth applicant of 2026 reads 2-026100');

insert into auth.users (id, aud, role, email, created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000016001', 'authenticated', 'authenticated', 'number-one@example.test', now(), now(), '{"first_name":"Uno","last_name":"Applicant"}'::jsonb),
  ('00000000-0000-4000-8000-000000016002', 'authenticated', 'authenticated', 'number-two@example.test', now(), now(), '{"first_name":"Dos","last_name":"Applicant"}'::jsonb);

select extensions.is(
  (select applicant_number::text like extract(year from now() at time zone 'Asia/Manila')::text || '%' from public.applicants where profile_id = '00000000-0000-4000-8000-000000016001'),
  true,
  'A new applicant number starts with the registration year'
);
select extensions.is(
  (select second.applicant_number - first.applicant_number
   from public.applicants first, public.applicants second
   where first.profile_id = '00000000-0000-4000-8000-000000016001' and second.profile_id = '00000000-0000-4000-8000-000000016002'),
  1::bigint,
  'Applicants registered in the same year are numbered consecutively'
);

insert into private.applicant_number_counters (registration_year, last_value) values (2031, 99);
select extensions.is(private.next_applicant_number(2031), 2031100::bigint, 'After 99 the yearly sequence continues at 100');
select extensions.is(private.next_applicant_number(2032), 203201::bigint, 'Each registration year starts again at 01');
select extensions.ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'applicant_profile_documents_delete_unreferenced_own'
  ),
  'Required applicant document objects cannot be deleted through the broad owner policy'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conname = 'applicants_gender_check' and pg_get_constraintdef(oid) like '%prefer_not_to_say%'),
  'Applicant gender values are constrained to the application type contract'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conname = 'employees_civil_status_check' and pg_get_constraintdef(oid) like '%divorced%'),
  'Employee civil status values are constrained to the application type contract'
);

select * from extensions.finish();
rollback;
