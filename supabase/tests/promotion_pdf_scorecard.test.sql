begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(8);

select extensions.has_function('private', 'evaluate_promotion_scorecard', array['uuid', 'date'], 'The PDF scorecard evaluator exists');

insert into public.employees (id, employee_number, first_name, last_name, personal_email, rank_id, employment_started_on)
values
  ('00000000-0000-4000-8000-000000012301', 'PDF-PCPL', 'PDF', 'Corporal', 'pdf-pcpl@example.test', (select id from public.ranks where code = 'PCPL'), (current_date - interval '4 years 1 day')::date),
  ('00000000-0000-4000-8000-000000012302', 'PDF-PAT', 'PDF', 'Patrolman', 'pdf-pat@example.test', (select id from public.ranks where code = 'PAT'), (current_date - interval '4 years')::date);

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

select * from extensions.finish();
rollback;
