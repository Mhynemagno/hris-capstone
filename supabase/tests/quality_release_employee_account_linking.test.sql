begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(8);

select extensions.has_function(
  'public',
  'list_unlinked_employee_accounts',
  array[]::text[],
  'HR account-candidate RPC exists'
);

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001601', 'authenticated', 'authenticated', 'link-hr@example.test', '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001602', 'authenticated', 'authenticated', 'link-admin@example.test', '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001603', 'authenticated', 'authenticated', 'link-applicant@example.test', '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001604', 'authenticated', 'authenticated', 'candidate.employee@example.test', '{"first_name":"Ariun","last_name":"Bold"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001605', 'authenticated', 'authenticated', 'linked.employee@example.test', '{"first_name":"Linked","last_name":"Employee"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001606', 'authenticated', 'authenticated', 'inactive.employee@example.test', '{"first_name":"Inactive","last_name":"Employee"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001607', 'authenticated', 'authenticated', 'link-management@example.test', '{}'::jsonb, now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000001601'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000001602'::uuid then 'system_administrator'::public.app_role
  when '00000000-0000-4000-8000-000000001603'::uuid then 'applicant'::public.app_role
  when '00000000-0000-4000-8000-000000001604'::uuid then 'employee'::public.app_role
  when '00000000-0000-4000-8000-000000001605'::uuid then 'employee'::public.app_role
  when '00000000-0000-4000-8000-000000001606'::uuid then 'employee'::public.app_role
  when '00000000-0000-4000-8000-000000001607'::uuid then 'management'::public.app_role
end
where user_id between '00000000-0000-4000-8000-000000001601'::uuid
  and '00000000-0000-4000-8000-000000001607'::uuid;

update public.profiles
set is_active = false
where id = '00000000-0000-4000-8000-000000001606'::uuid;

insert into public.employees (
  id, profile_id, employee_number, first_name, last_name, personal_email, employment_status, employment_started_on
)
values (
  '00000000-0000-4000-8000-000000001701',
  '00000000-0000-4000-8000-000000001605',
  'LINK-001',
  'Linked',
  'Employee',
  'linked.employee@example.test',
  'active',
  '2024-01-01'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001601';

select extensions.is(
  (select count(*) from public.list_unlinked_employee_accounts()),
  1::bigint,
  'HR sees exactly the active unlinked Employee account'
);

select extensions.is(
  (select first_name from public.list_unlinked_employee_accounts()),
  'Ariun',
  'HR receives the invited Employee first name for form prefill'
);

select extensions.is(
  (select last_name from public.list_unlinked_employee_accounts()),
  'Bold',
  'HR receives the invited Employee last name for form prefill'
);

select extensions.is(
  (select email from public.list_unlinked_employee_accounts()),
  'candidate.employee@example.test',
  'HR receives the invited Employee email for form prefill'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001607';

select extensions.throws_ok(
  $$select * from public.list_unlinked_employee_accounts()$$,
  '42501',
  null,
  'Management cannot discover Employee account candidates'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001602';

select extensions.throws_ok(
  $$select * from public.list_unlinked_employee_accounts()$$,
  '42501',
  null,
  'Administrators cannot discover Employee account candidates'
);

set local role anon;

select extensions.throws_ok(
  $$select * from public.list_unlinked_employee_accounts()$$,
  '42501',
  null,
  'Anonymous callers cannot discover Employee account candidates'
);

select * from extensions.finish();

rollback;
