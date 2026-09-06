begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(3);

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

select * from extensions.finish();
rollback;
