-- Applications were queued for AI analysis but nothing ever invoked the worker, and attempts left
-- queued or processing never timed out, so HR saw "Analyzing application…" forever.
-- This schedules the worker every minute and fails stale attempts so HR can retry them.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Attempts left queued or processing too long (worker never ran, crashed, or hit its time limit)
-- are failed so HR can retry them from the application screen.
create or replace function private.fail_stale_application_analyses(stale_after interval default interval '15 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed_count integer;
begin
  update public.application_ai_scores
  set status = 'failed',
      failure_code = 'timed_out',
      completed_at = now()
  where (status = 'queued' and queued_at < now() - stale_after)
     or (status = 'processing' and processing_started_at < now() - stale_after);
  get diagnostics failed_count = row_count;
  return failed_count;
end;
$$;
revoke all on function private.fail_stale_application_analyses(interval) from public, anon, authenticated;

-- Every minute: fail stale attempts, then ask the worker to drain the queue. The project URL and
-- the worker's shared secret live in Vault (see docs/AI_SHORTLISTING_SETUP.md); until both are
-- set the HTTP call is skipped and only the sweeper runs.
create or replace function private.run_application_analysis_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  worker_secret text;
begin
  perform private.fail_stale_application_analyses();

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'analysis_worker_secret';
  if base_url is null or worker_secret is null then return; end if;
  if not exists (select 1 from pgmq.q_application_analysis) then return; end if;

  perform net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/process-application-analysis',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-analysis-worker-secret', worker_secret),
    body := '{}'::jsonb,
    -- The worker analyses up to five applications per call, so allow it time to answer.
    timeout_milliseconds := 120000
  );
end;
$$;
revoke all on function private.run_application_analysis_tick() from public, anon, authenticated;

-- Replaces any earlier hand-made schedule (the hosted project had a broken
-- 'process-application-analysis-every-minute' job whose SQL failed every minute).
select cron.unschedule(jobid) from cron.job
where jobname in ('process-application-analysis', 'process-application-analysis-every-minute');
select cron.schedule('process-application-analysis', '* * * * *', 'select private.run_application_analysis_tick();');
