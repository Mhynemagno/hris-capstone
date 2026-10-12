begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

select extensions.has_function('public', 'search_text', array['employees'], 'Employees expose a search_text computed field');
select extensions.has_function('public', 'list_promotion_readiness_page', array['integer', 'integer', 'uuid', 'text'], 'Paged readiness accepts a search');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003301', 'authenticated', 'authenticated', 'search-hr@example.test', now(), now());
update public.user_roles set role = 'hr_personnel' where user_id = '00000000-0000-4000-8000-000000003301';

insert into public.ranks (id, name, code, sort_order, is_active) overriding system value
values (9920, 'Search Base Rank', 'SBR', 9920, true), (9921, 'Search Target Rank', 'STR', 9921, true);

insert into public.employees (id, employee_number, first_name, middle_name, last_name, personal_email, rank_id, employment_started_on, employment_status)
values
  ('00000000-0000-4000-8000-000000003311', 'SRCH-001', 'Juan', 'Santos', 'Dela Cruz', 'srch1@example.test', 9920, '2015-01-01', 'active'),
  ('00000000-0000-4000-8000-000000003312', 'SRCH-002', 'Maria', null, 'Retirado', 'srch2@example.test', 9920, '2015-01-01', 'active');

insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, status, capture_method)
values ('00000000-0000-4000-8000-000000003311', (select id from public.attendance_integration_settings where adapter_key = 'face_recognition'), 'search-test-1', 'SRCH-001', current_date, now(), 'incomplete', 'face_recognition');

select is(public.search_text(employee), 'srch-001 juan santos dela cruz', 'Employee search text joins badge number and every name part')
from public.employees employee where employee.id = '00000000-0000-4000-8000-000000003311';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003301';

select is(
  (select count(*)::integer from public.attendance_logs log where log.source_event_id = 'search-test-1' and public.search_text(log) ilike '%juan%' and public.search_text(log) ilike '%cruz%'),
  1,
  'Attendance search matches a full name across first and last name'
);

select set_config('test.criterion_id', public.create_promotion_criterion(9921, 1, null, '[]'::jsonb)::text, true);
select public.create_promotion_evaluation('00000000-0000-4000-8000-000000003311', 9921, current_setting('test.criterion_id')::uuid, current_date - 5, 'deferred', null, '[]'::jsonb);
select public.create_promotion_evaluation('00000000-0000-4000-8000-000000003312', 9921, current_setting('test.criterion_id')::uuid, current_date - 5, 'deferred', null, '[]'::jsonb);

select is(
  (select count(*)::integer from public.list_promotion_readiness_page(1, 100, null, 'cruz juan')),
  1,
  'Paged readiness search matches every word in any order'
);
select is(
  (select count(*)::integer from public.list_promotion_readiness_page(1, 100, null, 'juan nobody')),
  0,
  'Paged readiness search requires every word'
);

reset role;
update public.employees set employment_status = 'retired' where id = '00000000-0000-4000-8000-000000003312';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003301';

select is(
  (select count(*)::integer from public.list_promotion_readiness() where employee_id = '00000000-0000-4000-8000-000000003312'),
  0,
  'Retired personnel are left out of the readiness list (dashboard Promotion Notice)'
);
select is(
  (select count(*)::integer from public.list_promotion_readiness_page(1, 100, null, 'retirado')),
  0,
  'Retired personnel are left out of the paged readiness list'
);
select is(
  (select count(*)::integer from public.list_promotion_readiness('00000000-0000-4000-8000-000000003312')),
  1,
  'A retired employee''s own readiness can still be looked up by id'
);

select * from extensions.finish();
rollback;
