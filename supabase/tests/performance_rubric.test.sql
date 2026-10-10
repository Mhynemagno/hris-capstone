begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

select extensions.has_column('public', 'certifications', 'category', 'Certifications record their rubric category');
select extensions.has_function('public', 'record_performance_evaluation', array['uuid', 'date', 'date', 'text'], 'HR can record a rubric evaluation');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002601', 'authenticated', 'authenticated', 'rubric-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002602', 'authenticated', 'authenticated', 'rubric-employee@example.test', now(), now());
update public.user_roles set role = case user_id when '00000000-0000-4000-8000-000000002601'::uuid then 'hr_personnel'::public.app_role else 'employee'::public.app_role end
where user_id in ('00000000-0000-4000-8000-000000002601'::uuid, '00000000-0000-4000-8000-000000002602'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000002611', '00000000-0000-4000-8000-000000002602', 'RUB-001', 'Rubric', 'Officer', 'rubric-employee@example.test', '2014-01-15');

insert into public.certifications (employee_id, name, issued_on, expires_on) values
  ('00000000-0000-4000-8000-000000002611', 'Public Safety Basic Recruit Course (PSBRC)', '2014-06-01', null),
  ('00000000-0000-4000-8000-000000002611', 'Public Safety Junior Leadership Course (PSJLC)', '2018-06-01', null),
  ('00000000-0000-4000-8000-000000002611', 'Public Safety Senior Leadership Course (PSSLC)', '2022-06-01', null),
  ('00000000-0000-4000-8000-000000002611', 'Special Weapons and Tactics (SWAT) Course', '2019-06-01', null),
  ('00000000-0000-4000-8000-000000002611', 'Cybercrime Investigation Seminar', '2020-06-01', '2021-06-01'),
  ('00000000-0000-4000-8000-000000002611', 'Leadership and Management Course', '2021-06-01', null);

select extensions.is(
  (select array_agg(category order by name) from public.certifications where employee_id = '00000000-0000-4000-8000-000000002611'),
  array['specialized_training', null, 'mandatory_course', 'mandatory_course', 'mandatory_course', 'specialized_training'],
  'The category is set from the course name'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002601';

select extensions.is(
  public.get_performance_rubric('00000000-0000-4000-8000-000000002611', '2026-10-10') ->> 'totalPoints',
  '85',
  'Service (12 years = 45) + 3 mandatory capped at 30 + 1 valid specialized = 10 gives 85'
);
select extensions.lives_ok(
  $$select public.record_performance_evaluation('00000000-0000-4000-8000-000000002611', '2026-01-01', '2026-10-10', 'Annual review')$$,
  'HR records the evaluation'
);
select extensions.is(
  (select array[total_points::text, grade_equivalent, descriptive_rating, rating::text, service_points::text, mandatory_points::text, specialized_points::text]
   from public.performance_ratings where employee_id = '00000000-0000-4000-8000-000000002611'),
  array['85', '1.50', 'Very Satisfactory', '4', '45', '30', '10'],
  'The saved evaluation keeps the rubric breakdown and the matching 1-5 rating'
);
select extensions.throws_ok(
  $$select public.record_performance_evaluation('00000000-0000-4000-8000-000000002611', '2026-10-10', '2026-01-01', null)$$,
  '22023', null, 'The review period must end on or after it starts'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002602';
select extensions.throws_ok(
  $$select public.record_performance_evaluation('00000000-0000-4000-8000-000000002611', '2026-01-01', '2026-10-10', null)$$,
  '42501', null, 'Only HR can record an evaluation'
);
select extensions.throws_ok(
  $$select public.get_performance_rubric('00000000-0000-4000-8000-000000002611', '2026-10-10')$$,
  '42501', null, 'Only HR can preview the rubric'
);

select * from extensions.finish();

rollback;
