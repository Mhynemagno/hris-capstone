begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

select extensions.has_function('public', 'search_text', array['employees'], 'Employees expose a search_text computed field');
select extensions.has_function('public', 'list_promotion_candidates_page', array['text', 'text', 'integer', 'integer', 'uuid'], 'The promotion candidates list accepts a search');

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

-- Both employees meet every system requirement for the next rank (no HR criteria needed).
reset role;
insert into public.qualifications (employee_id, name, institution, awarded_on)
select id, 'NAPOLCOM PNP Entrance Examination', 'National Police Commission (NAPOLCOM)', '2014-06-01'
from public.employees where id in ('00000000-0000-4000-8000-000000003311', '00000000-0000-4000-8000-000000003312');
insert into public.performance_ratings (employee_id, rating, descriptive_rating, rating_kind, review_period_starts_on, review_period_ends_on)
select id, 5, 'Outstanding', 'iper', current_date - 150, current_date - 5
from public.employees where id in ('00000000-0000-4000-8000-000000003311', '00000000-0000-4000-8000-000000003312');
insert into public.physical_fitness_results (employee_id, result, assessed_on, valid_until, recorded_by_user_id)
select id, 'passed', current_date - 10, current_date + 300, '00000000-0000-4000-8000-000000003301'
from public.employees where id in ('00000000-0000-4000-8000-000000003311', '00000000-0000-4000-8000-000000003312');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003301';

select is(
  (select count(*)::integer from public.list_promotion_candidates_page('cruz juan', null, 1, 100)),
  1,
  'Promotion candidate search matches every word in any order'
);
select is(
  (select count(*)::integer from public.list_promotion_candidates_page('juan nobody', null, 1, 100)),
  0,
  'Promotion candidate search requires every word'
);

reset role;
update public.employees set employment_status = 'retired' where id = '00000000-0000-4000-8000-000000003312';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000003301';

select is(
  (select count(*)::integer from public.list_promotion_candidates_page(null, 'for_approval', 1, 100) where employee_id = '00000000-0000-4000-8000-000000003312'),
  0,
  'Retired personnel are left out of the promotion candidates (dashboard Promotion Notice)'
);
select is(
  (select count(*)::integer from public.list_promotion_candidates_page('retirado', null, 1, 100)),
  0,
  'Retired personnel are left out of the searched candidates list'
);
select is(
  public.get_promotion_evaluation('00000000-0000-4000-8000-000000003312') -> 'evaluation' ->> 'reason',
  'inactive',
  'A retired employee''s evaluation can still be looked up by id'
);

select * from extensions.finish();
rollback;
