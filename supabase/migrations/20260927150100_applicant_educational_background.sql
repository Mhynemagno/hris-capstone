-- "II. Educational Background" of the applicant personal data sheet (CS Form 212 order):
-- one row per level (elementary, secondary, college) holding the school, degree/course, and
-- year graduated. Applicants manage their own rows; HR can read them. The rows cascade with
-- the applicant profile so applicant-account deletion keeps working unchanged.

create table public.applicant_education (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  level text not null check (level in ('elementary', 'secondary', 'college')),
  school_name text check (school_name is null or (school_name = btrim(school_name) and char_length(school_name) between 1 and 200)),
  degree_course text check (degree_course is null or (degree_course = btrim(degree_course) and char_length(degree_course) between 1 and 200)),
  year_graduated smallint check (year_graduated is null or year_graduated between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, level)
);

create trigger applicant_education_touch_updated_at
  before update on public.applicant_education
  for each row execute procedure private.touch_updated_at();

alter table public.applicant_education enable row level security;
revoke all on table public.applicant_education from anon, authenticated;
grant select, delete on table public.applicant_education to authenticated;
grant insert (applicant_id, level, school_name, degree_course, year_graduated) on public.applicant_education to authenticated;
grant update (school_name, degree_course, year_graduated) on public.applicant_education to authenticated;

create policy applicant_education_select_own_or_hr
  on public.applicant_education for select to authenticated
  using (
    exists (
      select 1 from public.applicants applicant
      where applicant.id = applicant_education.applicant_id
        and applicant.profile_id = (select auth.uid())
    )
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create policy applicant_education_insert_own
  on public.applicant_education for insert to authenticated
  with check (
    exists (
      select 1 from public.applicants applicant
      where applicant.id = applicant_education.applicant_id
        and applicant.profile_id = (select auth.uid())
    )
  );

create policy applicant_education_update_own
  on public.applicant_education for update to authenticated
  using (
    exists (
      select 1 from public.applicants applicant
      where applicant.id = applicant_education.applicant_id
        and applicant.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.applicants applicant
      where applicant.id = applicant_education.applicant_id
        and applicant.profile_id = (select auth.uid())
    )
  );

create policy applicant_education_delete_own
  on public.applicant_education for delete to authenticated
  using (
    exists (
      select 1 from public.applicants applicant
      where applicant.id = applicant_education.applicant_id
        and applicant.profile_id = (select auth.uid())
    )
  );
