begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(19);

select extensions.has_function('private', 'evaluate_promotion_scorecard', array['uuid', 'date'], 'The PDF scorecard evaluator exists');
select extensions.has_table('public', 'promotion_assignment_records', 'Verified promotion assignment records exist');
select extensions.has_table('public', 'promotion_award_records', 'Verified promotion award records exist');
select extensions.has_table('public', 'promotion_board_assessments', 'Promotion Board assessment records exist');
select extensions.has_function('public', 'record_promotion_assignment', array['uuid', 'text', 'text', 'date', 'date', 'text'], 'HR assignment recording RPC exists');
select extensions.has_function('public', 'record_promotion_award', array['uuid', 'text', 'date', 'bigint', 'text'], 'HR award recording RPC exists');
select extensions.has_function('public', 'record_promotion_board_assessment', array['uuid', 'text', 'text', 'date', 'numeric', 'text'], 'HR board assessment recording RPC exists');

insert into public.employees (id, employee_number, first_name, last_name, personal_email, rank_id, employment_started_on)
values
  ('00000000-0000-4000-8000-000000012301', 'PDF-PCPL', 'PDF', 'Corporal', 'pdf-pcpl@example.test', (select id from public.ranks where code = 'PCPL'), (current_date - interval '4 years 1 day')::date),
  ('00000000-0000-4000-8000-000000012302', 'PDF-PAT', 'PDF', 'Patrolman', 'pdf-pat@example.test', (select id from public.ranks where code = 'PAT'), (current_date - interval '4 years')::date);
delete from public.promotion_assignment_records where employee_id in ('00000000-0000-4000-8000-000000012301', '00000000-0000-4000-8000-000000012302');
delete from public.promotion_award_records where employee_id in ('00000000-0000-4000-8000-000000012301', '00000000-0000-4000-8000-000000012302');
delete from public.promotion_board_assessments where employee_id in ('00000000-0000-4000-8000-000000012301', '00000000-0000-4000-8000-000000012302');

select extensions.is(
  private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) ->> 'band',
  'PCPL-PMSG',
  'PCPL is evaluated against the PCPL-PMSG PDF scorecard'
);
select extensions.is(
  (private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) ->> 'totalScore')::numeric,
  17::numeric,
  'Four years and one day in PCPL receives the PDF seniority score of 17'
);
insert into public.promotion_assignment_records (employee_id, assignment_kind, started_on, ended_on, evidence)
values ('00000000-0000-4000-8000-000000012301', 'field_or_quad', (current_date - interval '6 months')::date, current_date, 'Verified field assignment');
insert into public.promotion_award_records (employee_id, award_key, awarded_on, present_rank_id, evidence)
values ('00000000-0000-4000-8000-000000012301', 'medalya_ng_kagitingan', current_date, (select id from public.ranks where code = 'PCPL'), 'Award citation');
insert into public.promotion_board_assessments (employee_id, criterion, band, assessed_on, score, evidence)
values
  ('00000000-0000-4000-8000-000000012301', 'board', 'PCPL-PMSG', current_date, 15, 'Panel interview sheet'),
  ('00000000-0000-4000-8000-000000012301', 'reputation', 'PCPL-PMSG', current_date, 20, 'Records review');
select extensions.is(
  (private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) ->> 'totalScore')::numeric,
  63::numeric,
  'Recorded field assignment, award, and board evidence contribute their PDF points'
);
select extensions.is(
  (select (criterion ->> 'points')::numeric from jsonb_array_elements(private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) -> 'criteria') criterion where criterion ->> 'key' = 'assignment'),
  1::numeric,
  'A completed six-month field assignment earns one point'
);
select extensions.is(
  private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012302', current_date) ->> 'reason',
  'below_scored_rank',
  'PAT is outside the three PDF-scored promotion bands'
);
select extensions.ok(
  jsonb_array_length(private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) -> 'criteria') = 6,
  'The scorecard returns every PDF criterion'
);
select extensions.is(
  private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) ->> 'maximumScore',
  '100',
  'The complete scorecard is out of 100'
);
select extensions.ok(
  not (private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) ? 'isQualified'),
  'Scorecards do not infer an automatic qualification threshold'
);
select extensions.ok(
  (private.evaluate_promotion_scorecard('00000000-0000-4000-8000-000000012301', current_date) -> 'eligibility') ? 'record',
  'Eligibility remains visible outside the point total'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000012311', 'authenticated', 'authenticated', 'scorecard-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000012312', 'authenticated', 'authenticated', 'scorecard-employee@example.test', now(), now());
update public.user_roles set role = 'hr_personnel'::public.app_role where user_id = '00000000-0000-4000-8000-000000012311'::uuid;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000012311';
select extensions.lives_ok(
  $$select public.record_promotion_assignment('00000000-0000-4000-8000-000000012302', 'administrative', null, current_date - 30, current_date, 'HR verified assignment')$$,
  'HR can record verified score evidence through the secured RPC'
);
select extensions.ok(
  exists (select 1 from public.list_promotion_candidates_page('pdf corporal', null, 1, 100) where employee_id = '00000000-0000-4000-8000-000000012301'),
  'The HR scorecard list includes an active uniformed employee even without legacy qualification gates'
);
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000012312';
select extensions.throws_ok(
  $$select public.record_promotion_assignment('00000000-0000-4000-8000-000000012302', 'administrative', null, current_date - 30, current_date, 'Employee attempt')$$,
  '42501', null,
  'Employees cannot record promotion score evidence'
);
set local role postgres;

select * from extensions.finish();
rollback;
