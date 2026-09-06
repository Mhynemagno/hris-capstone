begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(7);

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
select extensions.ok(
  has_sequence_privilege('authenticated', 'public.applicant_number_seq', 'USAGE'),
  'Applicants can use the generated-number sequence when creating their profile'
);
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
  exists (select 1 from pg_constraint where conname = 'applicants_sex_check' and pg_get_constraintdef(oid) like '%prefer_not_to_say%'),
  'Applicant sex values are constrained to the application type contract'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conname = 'employees_civil_status_check' and pg_get_constraintdef(oid) like '%divorced%'),
  'Employee civil status values are constrained to the application type contract'
);

select * from extensions.finish();
rollback;
