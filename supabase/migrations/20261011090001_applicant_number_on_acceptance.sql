-- Capstone UI / Final Changes PDF p. 2: an applicant number is issued only once HR accepts the
-- application, i.e. when it leaves Application Submission for the Physical Agility Test (HR marks
-- the first stage Passed). Registration no longer assigns one, and the sign-up "your applicant
-- number" notification/email (20261010110001) is replaced by one sent on acceptance.
-- Applicants who already have a number keep it.

drop trigger applicants_assign_applicant_number on public.applicants;
drop function private.assign_applicant_number();
alter table public.applicants alter column applicant_number drop not null;

drop trigger applicants_notify_applicant_number on public.applicants;
drop function private.notify_applicant_number();

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
    when 'applicant_number_assigned' then 'applicant_welcome'
    else null
  end;

  if selected_template_key is null or new.link is null then
    return new;
  end if;

  insert into private.notification_email_outbox (
    notification_id, recipient_user_id, template_key, continue_path, notification_title, notification_body
  ) values (
    new.id, new.recipient_user_id, selected_template_key, new.link, new.title, new.body
  );

  return new;
end;
$$;

revoke all on function private.enqueue_notification_email() from public, anon, authenticated, service_role;

create function private.assign_applicant_number_on_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned bigint;
  recipient uuid;
begin
  if old.status <> 'Application Submission' or new.status in ('Application Submission', 'Not Selected') then
    return new;
  end if;

  update public.applicants applicant
  set applicant_number = private.next_applicant_number(private.applicant_registration_year(now()))
  where applicant.id = new.applicant_id and applicant.applicant_number is null
  returning applicant.applicant_number, applicant.profile_id into assigned, recipient;

  if assigned is null then
    return new;
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    recipient,
    'applicant_number_assigned',
    'Your applicant number',
    'Your application was accepted. Your applicant number is ' || public.format_applicant_number(assigned) || '.',
    '/applicant'
  );
  return new;
end;
$$;

revoke all on function private.assign_applicant_number_on_acceptance() from public, anon, authenticated;

create trigger applications_assign_applicant_number
  after update of status on public.applications
  for each row execute function private.assign_applicant_number_on_acceptance();
