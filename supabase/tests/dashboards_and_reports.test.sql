begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

select extensions.has_schema('reporting', 'Private reporting schema exists');
select extensions.has_function('public', 'get_hr_dashboard_summary', array['date', 'date'], 'HR dashboard RPC exists');
select extensions.has_function('public', 'get_management_dashboard_summary', array['date', 'date'], 'Management dashboard RPC exists');
select extensions.has_function('public', 'get_hr_report', array['text', 'date', 'date', 'bigint', 'text', 'integer', 'integer'], 'HR report RPC exists');
select extensions.has_function('public', 'get_management_report', array['text', 'date', 'date', 'bigint', 'text', 'integer', 'integer'], 'Management report RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001501', 'authenticated', 'authenticated', 'reports-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001502', 'authenticated', 'authenticated', 'reports-management@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001503', 'authenticated', 'authenticated', 'reports-employee@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000001501'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000001502'::uuid then 'management'::public.app_role
  else 'employee'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000001501'::uuid,
  '00000000-0000-4000-8000-000000001502'::uuid,
  '00000000-0000-4000-8000-000000001503'::uuid
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001501';
select extensions.ok(
  public.get_hr_dashboard_summary('2026-08-01', '2026-08-31') ? 'metrics',
  'HR receives a fixed dashboard payload'
);
select extensions.is(
  public.get_hr_report('deployments', '2026-08-01', '2026-08-31', null, null, 1, 25) ->> 'reportKey',
  'deployments', 'HR receives the requested whitelisted report'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001502';
select extensions.ok(
  public.get_management_report('employee-performance', '2026-08-01', '2026-08-31', null, null, 1, 25) ? 'rows',
  'Management receives a report payload'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001503';
select extensions.throws_ok(
  $$select public.get_management_dashboard_summary('2026-08-01', '2026-08-31')$$,
  '42501', null, 'Employee cannot call Management dashboard RPC'
);

select * from extensions.finish();

rollback;
