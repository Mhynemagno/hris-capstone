-- Queue generic transactional-email work for the small, approved notification matrix.
-- The queue intentionally stores no recipient email address or notification body: the worker
-- resolves the current address server-side and sends only generic copy.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table private.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique,
  recipient_user_id uuid not null,
  template_key text not null check (template_key in (
    'application_update',
    'application_remark',
    'leave_decision',
    'profile_change_decision',
    'deployment_update'
  )),
  continue_path text not null check (
    continue_path = btrim(continue_path)
    and left(continue_path, 1) = '/'
    and left(continue_path, 2) <> '//'
    and position(chr(92) in continue_path) = 0
    and continue_path !~ '[[:space:]]'
  ),
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 4),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  failure_code text,
  failure_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_email_outbox_ready_idx
  on private.notification_email_outbox (available_at, created_at)
  where status = 'pending';

create index notification_email_outbox_stale_idx
  on private.notification_email_outbox (locked_at)
  where status = 'sending';

revoke all on table private.notification_email_outbox from public, anon, authenticated, service_role;

create or replace function private.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_template_key text;
begin
  selected_template_key := case new.type
    when 'application_status_updated' then 'application_update'
    when 'application_remark_added' then 'application_remark'
    when 'leave_request_decision' then 'leave_decision'
    when 'profile_change_decision' then 'profile_change_decision'
    when 'deployment_assigned' then 'deployment_update'
    when 'deployment_updated' then 'deployment_update'
    else null
  end;

  if selected_template_key is null or new.link is null then
    return new;
  end if;

  insert into private.notification_email_outbox (
    notification_id,
    recipient_user_id,
    template_key,
    continue_path
  ) values (
    new.id,
    new.recipient_user_id,
    selected_template_key,
    new.link
  );

  return new;
end;
$$;

revoke all on function private.enqueue_notification_email() from public, anon, authenticated, service_role;

drop trigger if exists notification_email_outbox_enqueue on public.notifications;
create trigger notification_email_outbox_enqueue
  after insert on public.notifications
  for each row execute function private.enqueue_notification_email();

create or replace function private.recover_stale_notification_email_jobs(
  stale_after interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovered_count integer;
begin
  update private.notification_email_outbox
  set status = 'pending',
      available_at = now(),
      locked_at = null,
      failure_code = 'worker_timeout',
      failure_detail = 'The email worker did not report a result before its lease expired.',
      updated_at = now()
  where status = 'sending'
    and locked_at < now() - stale_after;

  get diagnostics recovered_count = row_count;
  return recovered_count;
end;
$$;

create or replace function private.claim_notification_email_jobs(max_jobs integer)
returns table (
  id uuid,
  recipient_user_id uuid,
  template_key text,
  continue_path text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if max_jobs is null or max_jobs not between 1 and 50 then
    raise exception 'max_jobs must be between 1 and 50.' using errcode = '22023';
  end if;

  perform private.recover_stale_notification_email_jobs();

  return query
  with claimed_jobs as (
    select job.id
    from private.notification_email_outbox job
    where job.status = 'pending'
      and job.available_at <= now()
    order by job.available_at, job.created_at
    for update skip locked
    limit max_jobs
  )
  update private.notification_email_outbox job
  set status = 'sending',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  from claimed_jobs
  where job.id = claimed_jobs.id
  returning job.id, job.recipient_user_id, job.template_key, job.continue_path;
end;
$$;

create or replace function private.complete_notification_email_job(
  target_job_id uuid,
  target_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_provider_message_id is null or char_length(btrim(target_provider_message_id)) = 0 then
    raise exception 'A provider message ID is required.' using errcode = '22023';
  end if;

  update private.notification_email_outbox
  set status = 'accepted',
      locked_at = null,
      provider_message_id = left(btrim(target_provider_message_id), 512),
      failure_code = null,
      failure_detail = null,
      updated_at = now()
  where id = target_job_id
    and status = 'sending';

  return found;
end;
$$;

create or replace function private.fail_notification_email_job(
  target_job_id uuid,
  target_failure_code text,
  target_failure_detail text,
  should_retry boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.notification_email_outbox
  set status = case when should_retry and attempt_count < 4 then 'pending' else 'failed' end,
      available_at = case
        when should_retry and attempt_count = 1 then now() + interval '5 minutes'
        when should_retry and attempt_count = 2 then now() + interval '30 minutes'
        when should_retry and attempt_count = 3 then now() + interval '2 hours'
        else available_at
      end,
      locked_at = null,
      failure_code = left(coalesce(nullif(btrim(target_failure_code), ''), 'provider_error'), 100),
      failure_detail = left(coalesce(nullif(btrim(target_failure_detail), ''), 'The email provider did not accept the message.'), 500),
      updated_at = now()
  where id = target_job_id
    and status = 'sending';

  return found;
end;
$$;

revoke all on function private.recover_stale_notification_email_jobs(interval),
  private.claim_notification_email_jobs(integer),
  private.complete_notification_email_job(uuid, text),
  private.fail_notification_email_job(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.claim_notification_email_jobs(max_jobs integer)
returns table (
  id uuid,
  recipient_user_id uuid,
  template_key text,
  continue_path text
)
language sql
security definer
set search_path = ''
as $$
  select * from private.claim_notification_email_jobs(max_jobs);
$$;

create or replace function public.complete_notification_email_job(
  target_job_id uuid,
  target_provider_message_id text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.complete_notification_email_job(target_job_id, target_provider_message_id);
$$;

create or replace function public.fail_notification_email_job(
  target_job_id uuid,
  target_failure_code text,
  target_failure_detail text,
  should_retry boolean
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.fail_notification_email_job(target_job_id, target_failure_code, target_failure_detail, should_retry);
$$;

revoke all on function public.claim_notification_email_jobs(integer),
  public.complete_notification_email_job(uuid, text),
  public.fail_notification_email_job(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_email_jobs(integer),
  public.complete_notification_email_job(uuid, text),
  public.fail_notification_email_job(uuid, text, text, boolean)
  to service_role;

create or replace function private.run_notification_email_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  worker_secret text;
begin
  perform private.recover_stale_notification_email_jobs();

  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name = 'project_url';
  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'email_notification_worker_secret';

  if base_url is null or worker_secret is null then
    return;
  end if;

  if not exists (
    select 1
    from private.notification_email_outbox
    where status = 'pending'
      and available_at <= now()
  ) then
    return;
  end if;

  perform net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-notification-worker-secret', worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function private.run_notification_email_tick() from public, anon, authenticated, service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'send-notification-email';
select cron.schedule(
  'send-notification-email',
  '* * * * *',
  'select private.run_notification_email_tick();'
);
