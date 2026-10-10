-- Applicants log in with their applicant number, so a new self-registered applicant is told the number
-- right away: an in-app notification that the email worker also sends to their address.
-- Only accounts created by the applicant registration form (metadata "registration": "applicant") get it;
-- accounts an administrator invites also start with an applicant row and must not.

alter table private.notification_email_outbox drop constraint notification_email_outbox_template_key_check;
alter table private.notification_email_outbox add constraint notification_email_outbox_template_key_check check (template_key in (
  'application_update',
  'application_remark',
  'leave_decision',
  'profile_change_decision',
  'deployment_update',
  'applicant_welcome'
));

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
    when 'applicant_registered' then 'applicant_welcome'
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

revoke all on function private.enqueue_notification_email() from public, anon, authenticated, service_role;

create function private.notify_applicant_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  padded text;
begin
  if new.applicant_number is null
    or not exists (select 1 from auth.users account where account.id = new.profile_id and account.raw_user_meta_data ->> 'registration' = 'applicant')
  then
    return new;
  end if;
  -- Shown like the app does: 202601 -> "2-02601".
  padded := lpad(new.applicant_number::text, 6, '0');
  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    new.profile_id,
    'applicant_registered',
    'Your applicant number',
    'Welcome to the PNP San Juan City recruitment portal. Your applicant number is ' || left(padded, 1) || '-' || substr(padded, 2)
      || '. Use your applicant number and password to log in as an applicant.',
    '/applicant'
  );
  return new;
end;
$$;

revoke all on function private.notify_applicant_number() from public, anon, authenticated;

create trigger applicants_notify_applicant_number
  after insert on public.applicants
  for each row execute function private.notify_applicant_number();
