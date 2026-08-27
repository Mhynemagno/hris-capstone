-- Fictitious local-only demonstration data. The shared password is for local demo accounts only:
-- DemoPass!2026. Do not use these addresses, IDs, or credentials in production.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000008101', 'authenticated', 'authenticated', 'demo.admin@example.test', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"first_name":"Demo","last_name":"Administrator","full_name":"Demo Administrator"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000008102', 'authenticated', 'authenticated', 'demo.hr@example.test', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"first_name":"Demo","last_name":"Human Resources","full_name":"Demo Human Resources"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000008103', 'authenticated', 'authenticated', 'demo.employee@example.test', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"first_name":"Demo","last_name":"Employee","full_name":"Demo Employee"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000008104', 'authenticated', 'authenticated', 'demo.applicant@example.test', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"first_name":"Demo","last_name":"Applicant","full_name":"Demo Applicant"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000008105', 'authenticated', 'authenticated', 'demo.management@example.test', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"first_name":"Demo","last_name":"Management","full_name":"Demo Management"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000008106', 'authenticated', 'authenticated', 'demo.unlinked-employee@example.test', crypt('DemoPass!2026', gen_salt('bf')), now(), '{"first_name":"Awaiting","last_name":"Record","full_name":"Awaiting Record"}'::jsonb, now(), now())
on conflict (id) do update set instance_id = excluded.instance_id, email = excluded.email, encrypted_password = excluded.encrypted_password, email_confirmed_at = excluded.email_confirmed_at, raw_user_meta_data = excluded.raw_user_meta_data, updated_at = now();

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
where id between '00000000-0000-4000-8000-000000008101'::uuid and '00000000-0000-4000-8000-000000008106'::uuid;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  user_row.id,
  user_row.id::text,
  user_row.id,
  jsonb_build_object('sub', user_row.id::text, 'email', user_row.email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(),
  now(),
  now()
from auth.users user_row
where user_row.id between '00000000-0000-4000-8000-000000008101'::uuid and '00000000-0000-4000-8000-000000008106'::uuid
on conflict (provider_id, provider) do update set user_id = excluded.user_id, identity_data = excluded.identity_data, updated_at = now();

insert into public.profiles (id, email, full_name, is_active)
select id, email, raw_user_meta_data ->> 'full_name', true
from auth.users
where id between '00000000-0000-4000-8000-000000008101'::uuid and '00000000-0000-4000-8000-000000008106'::uuid
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, is_active = true;

insert into public.user_roles (user_id, role)
values
  ('00000000-0000-4000-8000-000000008101', 'system_administrator'),
  ('00000000-0000-4000-8000-000000008102', 'hr_personnel'),
  ('00000000-0000-4000-8000-000000008103', 'employee'),
  ('00000000-0000-4000-8000-000000008104', 'applicant'),
  ('00000000-0000-4000-8000-000000008105', 'management'),
  ('00000000-0000-4000-8000-000000008106', 'employee')
on conflict (user_id) do update set role = excluded.role, assigned_at = now();

insert into public.departments (name) values ('Demo Operations') on conflict (name) do update set is_active = true;
insert into public.positions (department_id, title)
select id, 'Demo Officer' from public.departments where name = 'Demo Operations'
on conflict (department_id, title) do update set is_active = true;

insert into public.employees (profile_id, employee_number, first_name, last_name, personal_email, department_id, position_id, employment_status, employment_started_on)
select
  '00000000-0000-4000-8000-000000008103'::uuid,
  'DEMO-001',
  'Demo',
  'Employee',
  'demo.employee@example.test',
  department.id,
  position.id,
  'active',
  '2024-01-01'
from public.departments department
join public.positions position on position.department_id = department.id and position.title = 'Demo Officer'
where department.name = 'Demo Operations'
on conflict (profile_id) do update set first_name = excluded.first_name, last_name = excluded.last_name, personal_email = excluded.personal_email;

insert into public.leave_types (name, description, requires_attachment, created_by_user_id, updated_by_user_id)
select 'Demo leave', 'Fictitious demo leave type', false, '00000000-0000-4000-8000-000000008102'::uuid, '00000000-0000-4000-8000-000000008102'::uuid
where not exists (select 1 from public.leave_types where name = 'Demo leave');

insert into public.job_openings (department_id, position_id, title, description, status, published_at, created_by_user_id)
select department.id, position.id, 'Demo Officer Opening', 'Fictitious opening used only for local HRIS demonstrations.', 'published', now(), '00000000-0000-4000-8000-000000008102'::uuid
from public.departments department
join public.positions position on position.department_id = department.id and position.title = 'Demo Officer'
where department.name = 'Demo Operations'
  and not exists (select 1 from public.job_openings where title = 'Demo Officer Opening');

insert into public.applicants (profile_id, first_name, last_name)
values ('00000000-0000-4000-8000-000000008104', 'Demo', 'Applicant')
on conflict (profile_id) do update set first_name = excluded.first_name, last_name = excluded.last_name;
