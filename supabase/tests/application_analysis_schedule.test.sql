begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(9);

select extensions.has_function('private', 'fail_stale_application_analyses', array['interval'], 'Stale analysis sweeper exists');
select extensions.ok(
  exists (select 1 from cron.job where jobname = 'process-application-analysis' and schedule = '* * * * *'),
  'The analysis worker is scheduled every minute'
);
select extensions.is(
  (select count(*)::int from cron.job where jobname like 'process-application-analysis%'),
  1, 'Only one analysis schedule exists'
);

-- Fixture: three applications with a stale queued, a stale processing, and a fresh attempt.
insert into public.job_openings (id, department_id, rank_id, title, description, status, created_by_user_id) overriding system value
select opening_id, (select id from public.departments order by id limit 1), (select id from public.ranks where code = 'Pat'),
  'Sweeper fixture opening ' || opening_id, 'An opening used only by the analysis sweeper tests.', 'draft',
  '00000000-0000-4000-8000-000000008102'
from (values (990001), (990002), (990003)) fixture(opening_id);
insert into public.applications (id, applicant_id, job_opening_id)
select application_id::uuid, (select id from public.applicants where profile_id = '00000000-0000-4000-8000-000000008104'), opening_id
from (values
  ('00000000-0000-4000-8000-000000099001', 990001),
  ('00000000-0000-4000-8000-000000099002', 990002),
  ('00000000-0000-4000-8000-000000099003', 990003)
) fixture(application_id, opening_id);

insert into public.application_ai_scores (id, application_id, requested_by_user_id, status, created_at, queued_at, processing_started_at)
values
  ('00000000-0000-4000-8000-000000099101', '00000000-0000-4000-8000-000000099001', '00000000-0000-4000-8000-000000008104', 'queued',
    now() - interval '20 minutes', now() - interval '20 minutes', null),
  ('00000000-0000-4000-8000-000000099102', '00000000-0000-4000-8000-000000099002', '00000000-0000-4000-8000-000000008104', 'processing',
    now() - interval '30 minutes', now() - interval '30 minutes', now() - interval '20 minutes'),
  ('00000000-0000-4000-8000-000000099103', '00000000-0000-4000-8000-000000099003', '00000000-0000-4000-8000-000000008104', 'queued',
    now(), now(), null);

select extensions.is(private.fail_stale_application_analyses('15 minutes'), 2, 'Two stale attempts are failed');
select extensions.is(
  (select string_agg(status || ':' || coalesce(failure_code, '-'), ',' order by id) from public.application_ai_scores
    where id between '00000000-0000-4000-8000-000000099101' and '00000000-0000-4000-8000-000000099103'),
  'failed:timed_out,failed:timed_out,queued:-',
  'Stale queued and processing attempts time out; the fresh attempt is untouched'
);
select extensions.ok(
  (select completed_at is not null from public.application_ai_scores where id = '00000000-0000-4000-8000-000000099102'),
  'Timed-out attempts record when they were failed'
);
select extensions.is(private.fail_stale_application_analyses('15 minutes'), 0, 'The sweeper is idempotent');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000008102';
select extensions.throws_ok(
  $$select private.fail_stale_application_analyses('15 minutes')$$,
  '42501', null, 'Signed-in users cannot run the sweeper'
);
set local role postgres;

-- Without Vault secrets the tick only sweeps and never calls the worker.
select extensions.lives_ok($$select private.run_application_analysis_tick()$$, 'The scheduled tick runs without Vault secrets');

select * from extensions.finish();

rollback;
