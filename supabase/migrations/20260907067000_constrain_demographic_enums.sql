update public.applicants set sex = null where sex is not null and sex not in ('female', 'male', 'prefer_not_to_say');
update public.applicants set civil_status = null where civil_status is not null and civil_status not in ('single', 'married', 'widowed', 'separated', 'divorced');
update public.employees set sex = null where sex is not null and sex not in ('female', 'male', 'prefer_not_to_say');
update public.employees set civil_status = null where civil_status is not null and civil_status not in ('single', 'married', 'widowed', 'separated', 'divorced');

alter table public.applicants
  drop constraint applicants_sex_check,
  add constraint applicants_sex_check check (sex is null or sex in ('female', 'male', 'prefer_not_to_say')),
  drop constraint applicants_civil_status_check,
  add constraint applicants_civil_status_check check (civil_status is null or civil_status in ('single', 'married', 'widowed', 'separated', 'divorced'));

alter table public.employees
  drop constraint employees_sex_check,
  add constraint employees_sex_check check (sex is null or sex in ('female', 'male', 'prefer_not_to_say')),
  drop constraint employees_civil_status_check,
  add constraint employees_civil_status_check check (civil_status is null or civil_status in ('single', 'married', 'widowed', 'separated', 'divorced'));
