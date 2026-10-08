-- Snapshot the complete in-app notification content so the email says exactly
-- what the recipient would see in HRIS. The private queue remains unavailable
-- to browser roles.

alter table private.notification_email_outbox
  add column notification_title text,
  add column notification_body text;

update private.notification_email_outbox job
set notification_title = notification.title,
    notification_body = notification.body
from public.notifications notification
where notification.id = job.notification_id;

alter table private.notification_email_outbox
  alter column notification_title set not null,
  alter column notification_body set not null;

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
    continue_path,
    notification_title,
    notification_body
  ) values (
    new.id,
    new.recipient_user_id,
    selected_template_key,
    new.link,
    new.title,
    new.body
  );

  return new;
end;
$$;

drop function public.claim_notification_email_jobs(integer);
drop function private.claim_notification_email_jobs(integer);

create function private.claim_notification_email_jobs(max_jobs integer)
returns table (
  id uuid,
  recipient_user_id uuid,
  template_key text,
  continue_path text,
  notification_title text,
  notification_body text
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
  returning job.id, job.recipient_user_id, job.template_key, job.continue_path, job.notification_title, job.notification_body;
end;
$$;

create function public.claim_notification_email_jobs(max_jobs integer)
returns table (
  id uuid,
  recipient_user_id uuid,
  template_key text,
  continue_path text,
  notification_title text,
  notification_body text
)
language sql
security definer
set search_path = ''
as $$
  select * from private.claim_notification_email_jobs(max_jobs);
$$;

revoke all on function private.claim_notification_email_jobs(integer) from public, anon, authenticated, service_role;
revoke all on function public.claim_notification_email_jobs(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_notification_email_jobs(integer) to service_role;

-- Current deployment records use scheduled, ongoing, completed, and cancelled,
-- not the obsolete active status. Any employee deployment assignment or update
-- now creates the in-app notification that feeds the email queue.
create or replace function private.notify_deployment_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if tg_op = 'UPDATE'
    and new.location is not distinct from old.location
    and new.starts_on is not distinct from old.starts_on
    and new.status is not distinct from old.status then
    return new;
  end if;

  select employee.profile_id into recipient from public.employees employee where employee.id = new.employee_id;
  if recipient is null then return new; end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    recipient,
    case when tg_op = 'INSERT' then 'deployment_assigned' else 'deployment_updated' end,
    case when tg_op = 'INSERT' then 'New deployment assigned' else 'Deployment updated' end,
    format('You are deployed to %s starting %s.',
      coalesce(nullif(btrim(new.location), ''), nullif(btrim(new.unit), ''), 'a new assignment'),
      to_char(new.starts_on, 'FMMonth FMDD, YYYY')),
    '/employee/deployments'
  );
  return new;
end;
$$;
