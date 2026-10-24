-- A failed stage transitions an application to Not Selected. Keep the application record and
-- history, but suspend the applicant profile in the same transaction. The existing
-- profiles_sync_auth_sign_in_block trigger then bans the Auth user and removes live sessions.
create function private.block_rejected_applicant_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Not Selected' and old.status is distinct from new.status then
    update public.profiles profile
    set is_active = false
    from public.applicants applicant
    where applicant.id = new.applicant_id
      and profile.id = applicant.profile_id
      and profile.is_active;
  end if;
  return new;
end;
$$;

revoke all on function private.block_rejected_applicant_sign_in() from public, anon, authenticated;

create trigger applications_block_rejected_applicant_sign_in
after update of status on public.applications
for each row
when (new.status = 'Not Selected' and old.status is distinct from new.status)
execute function private.block_rejected_applicant_sign_in();

-- Apply the same access rule to applicants who had already been marked Not Selected before
-- this migration. An applicant with another in-progress or successful application stays active.
update public.profiles profile
set is_active = false
from public.applicants applicant
where profile.id = applicant.profile_id
  and profile.is_active
  and exists (
    select 1
    from public.applications application
    where application.applicant_id = applicant.id
      and application.status = 'Not Selected'
  )
  and not exists (
    select 1
    from public.applications application
    where application.applicant_id = applicant.id
      and application.status <> 'Not Selected'
  );

-- Reopening an applicant account is the controlled entry point for a new application.
-- HR cannot override the six-month cooling-off period after a failed recruitment stage.
create or replace function public.reactivate_applicant_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  target_is_active boolean;
begin
  select profile.is_active into target_is_active
  from public.profiles profile
  join public.user_roles user_role on user_role.user_id = profile.id
  where profile.id = target_user_id and user_role.role = 'applicant'::public.app_role
  for update of profile;

  if target_is_active is null then
    raise exception 'Applicant account was not found.' using errcode = 'P0001';
  end if;
  if target_is_active then
    return;
  end if;
  if exists (
    select 1
    from public.applicants applicant
    join public.applications application on application.applicant_id = applicant.id
    join public.application_status_history history on history.application_id = application.id
    where applicant.profile_id = target_user_id
      and history.next_status = 'Not Selected'
      and history.result = 'failed'
      and history.created_at > now() - interval '6 months'
  ) then
    raise exception 'Applicant accounts can only be reactivated six months after rejection.' using errcode = '22023';
  end if;

  update public.profiles set is_active = true where id = target_user_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'profiles', target_user_id::text, 'applicant_account_reactivated', jsonb_build_object('role', 'applicant'));

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (target_user_id, 'application_status_updated', 'Account reactivated', 'HR reactivated your applicant account. You can sign in again.', '/applicant');
end;
$$;

revoke all on function public.reactivate_applicant_account(uuid) from public, anon;
grant execute on function public.reactivate_applicant_account(uuid) to authenticated;
