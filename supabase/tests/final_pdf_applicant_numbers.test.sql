begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(4);

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000006901', 'authenticated', 'authenticated', 'numbered@example.test', '{"first_name":"Numbered","last_name":"Applicant","registration":"applicant"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000006902', 'authenticated', 'authenticated', 'numbered2@example.test', '{"first_name":"Second","last_name":"Applicant","registration":"applicant"}'::jsonb, now(), now());

select extensions.ok(
  (select applicant_number is not null from public.applicants where profile_id = '00000000-0000-4000-8000-000000006901'),
  'Every registered applicant receives a persistent applicant number before submitting documents'
);
select extensions.ok(
  (select applicant_number is not null from public.applicants where profile_id = '00000000-0000-4000-8000-000000006902'),
  'A second registered applicant also receives an applicant number'
);
select extensions.ok(
  (select applicant_number from public.applicants where profile_id = '00000000-0000-4000-8000-000000006901') <> (select applicant_number from public.applicants where profile_id = '00000000-0000-4000-8000-000000006902'),
  'Applicant numbers remain unique'
);
select extensions.is(
  (select count(*) from public.applicants where applicant_number is null), 0::bigint,
  'Existing applicant records are backfilled rather than left without identifiers'
);

select * from extensions.finish();
rollback;
