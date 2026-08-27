create extension if not exists pgmq;

select pgmq.create('application_analysis');

alter table public.application_ai_scores
  drop constraint application_ai_scores_status_check,
  drop constraint application_ai_scores_check,
  add column attempt_count smallint not null default 0 check (attempt_count between 0 and 2),
  add column queued_at timestamptz not null default now(),
  add column processing_started_at timestamptz,
  add constraint application_ai_scores_status_check
    check (status in ('queued', 'processing', 'completed', 'failed')),
  add constraint application_ai_scores_state_check check (
    (status = 'queued'
      and score is null and explanation is null and provider is null
      and model is null and model_version is null and failure_code is null
      and processing_started_at is null and completed_at is null)
    or (status = 'processing'
      and score is null and explanation is null and provider is null
      and model is null and model_version is null and failure_code is null
      and processing_started_at is not null and completed_at is null)
    or (status = 'completed'
      and score is not null and explanation is not null and provider is not null
      and model is not null and model_version is not null and failure_code is null
      and completed_at is not null)
    or (status = 'failed'
      and score is null and explanation is null and provider is null
      and model is null and model_version is null and failure_code is not null
      and completed_at is not null)
  );

create index application_ai_scores_active_attempt_idx
  on public.application_ai_scores (application_id, created_at desc)
  where status in ('queued', 'processing');

create or replace function private.queue_application_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  score_id uuid;
begin
  if caller_id is null or not exists (
    select 1 from public.user_roles
    where user_id = caller_id and role = 'applicant'::public.app_role
  ) then
    return new;
  end if;

  insert into public.application_ai_scores (application_id, requested_by_user_id, status)
  values (new.id, caller_id, 'queued')
  returning id into score_id;

  perform pgmq.send('application_analysis', jsonb_build_object('scoreId', score_id));
  return new;
end;
$$;

create trigger applications_queue_ai_analysis
  after insert on public.applications
  for each row execute function private.queue_application_analysis();

revoke all on function private.queue_application_analysis() from public, anon, authenticated;
