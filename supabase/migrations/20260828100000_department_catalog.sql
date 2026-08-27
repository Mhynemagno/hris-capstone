-- Replace the active department catalogue with the client-approved list from Departments.txt.
-- Legacy rows are retired rather than deleted so existing employee, position, job-opening, and
-- reporting references remain historically accurate.
insert into public.departments (name, is_active)
values
  ('Operations Division', true),
  ('Women and Children Protection Desk', true),
  ('Administrative & Intelligence Division', true)
on conflict (name) do update
set
  is_active = true,
  updated_at = now();

update public.departments
set
  is_active = false,
  updated_at = now()
where name not in (
  'Operations Division',
  'Women and Children Protection Desk',
  'Administrative & Intelligence Division'
)
  and is_active;
