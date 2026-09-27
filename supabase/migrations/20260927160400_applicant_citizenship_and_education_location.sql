-- Applicant personal data sheet feedback:
-- 1. "Citizenship" is a new Personal Information field. It stays nullable in the database so
--    existing rows remain valid; the profile form requires it (and prefills "Filipino").
-- 2. Educational Background levels are now Primary (stored as 'elementary'), Secondary,
--    Bachelor's Degree (stored as 'college') and a new optional Graduate Degree ('graduate').
--    Every level also records the school location.

alter table public.applicants
  add column citizenship text check (
    citizenship is null or (citizenship = btrim(citizenship) and char_length(citizenship) between 1 and 80)
  );

grant insert (citizenship) on public.applicants to authenticated;
grant update (citizenship) on public.applicants to authenticated;

alter table public.applicant_education
  drop constraint applicant_education_level_check,
  add constraint applicant_education_level_check
    check (level in ('elementary', 'secondary', 'college', 'graduate')),
  add column location text check (
    location is null or (location = btrim(location) and char_length(location) between 1 and 200)
  );

grant insert (location) on public.applicant_education to authenticated;
grant update (location) on public.applicant_education to authenticated;
