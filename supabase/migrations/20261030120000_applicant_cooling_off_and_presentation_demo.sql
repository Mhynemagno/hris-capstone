-- A recruitment rejection is temporary access suspension, not a permanent account deactivation.
alter table public.profiles add column applicant_cooling_off_ends_at timestamptz;

-- The previous implementation stored a rejection as a permanent deactivation. Convert only
-- applicants whose recorded applications are all Not Selected, preserving deliberate account
-- deactivations for applicants who have another active application.
with last_rejection as (
  select applicant.profile_id, max(history.created_at) + interval '6 months' as cooling_off_ends_at
  from public.applicants applicant
  join public.applications application on application.applicant_id = applicant.id
  join public.application_status_history history on history.application_id = application.id
  join public.user_roles role on role.user_id = applicant.profile_id and role.role = 'applicant'::public.app_role
  where history.next_status = 'Not Selected'
    and not exists (
      select 1 from public.applications other_application
      where other_application.applicant_id = applicant.id and other_application.status <> 'Not Selected'
    )
  group by applicant.profile_id
), restored_profiles as (
  update public.profiles profile
  set applicant_cooling_off_ends_at = last_rejection.cooling_off_ends_at,
      is_active = true
  from last_rejection
  where profile.id = last_rejection.profile_id
    and profile.is_active = false
  returning profile.id, profile.applicant_cooling_off_ends_at
)
update auth.users user_row
set banned_until = case
  when restored_profiles.applicant_cooling_off_ends_at > now() then restored_profiles.applicant_cooling_off_ends_at
  else null
end
from restored_profiles
where user_row.id = restored_profiles.id;

create table public.applicant_login_presentation_demo (
  id boolean primary key default true check (id),
  target_user_id uuid references public.profiles(id) on delete cascade,
  simulated_at timestamptz,
  expires_at timestamptz,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((target_user_id is null) = (simulated_at is null)),
  check ((target_user_id is null) = (expires_at is null))
);
alter table public.applicant_login_presentation_demo enable row level security;
revoke all on public.applicant_login_presentation_demo from public, anon, authenticated;

create or replace function private.profile_can_access(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select profile.is_active and (
      not exists (select 1 from public.user_roles role where role.user_id = profile.id and role.role = 'applicant'::public.app_role)
      or profile.applicant_cooling_off_ends_at is null
      or profile.applicant_cooling_off_ends_at <= now()
      or exists (
        select 1 from public.applicant_login_presentation_demo demo
        where demo.id and demo.target_user_id = profile.id
          and demo.simulated_at >= profile.applicant_cooling_off_ends_at
          and demo.expires_at > now()
      )
    )
    from public.profiles profile where profile.id = target_user_id
  ), false);
$$;
revoke all on function private.profile_can_access(uuid) from public, anon, authenticated;

create or replace function private.current_user_has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and private.profile_can_access((select auth.uid()))
    and exists (select 1 from public.user_roles role where role.user_id = (select auth.uid()) and role.role = required_role);
$$;

create or replace function public.current_account_can_sign_in()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.profile_can_access((select auth.uid()));
$$;
revoke all on function public.current_account_can_sign_in() from public, anon;
grant execute on function public.current_account_can_sign_in() to authenticated;

drop trigger if exists applications_block_rejected_applicant_sign_in on public.applications;
create or replace function private.block_rejected_applicant_sign_in()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  blocked_user_id uuid;
  blocked_until timestamptz := now() + interval '6 months';
begin
  if new.status = 'Not Selected' and old.status is distinct from new.status then
    select applicant.profile_id into blocked_user_id from public.applicants applicant where applicant.id = new.applicant_id;
    update public.profiles set applicant_cooling_off_ends_at = blocked_until where id = blocked_user_id;
    begin
      update auth.users set banned_until = blocked_until where id = blocked_user_id;
      delete from auth.sessions where user_id = blocked_user_id;
    exception when insufficient_privilege or undefined_table or undefined_column then null;
    end;
  end if;
  return new;
end;
$$;
create trigger applications_block_rejected_applicant_sign_in after update of status on public.applications
for each row when (new.status = 'Not Selected' and old.status is distinct from new.status)
execute function private.block_rejected_applicant_sign_in();

-- System Administrators may temporarily make one deliberately-created demo applicant behave as if six months passed.
create or replace function public.get_applicant_login_presentation_demo()
returns table (email text, cooling_off_ends_at timestamptz, simulated_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.current_user_has_role('system_administrator'::public.app_role) then raise exception 'System Administrator access is required.' using errcode = '42501'; end if;
  return query select profile.email, profile.applicant_cooling_off_ends_at, demo.simulated_at, demo.expires_at
  from public.applicant_login_presentation_demo demo left join public.profiles profile on profile.id = demo.target_user_id where demo.id;
end;
$$;
create or replace function public.set_applicant_login_presentation_demo(target_email text, requested_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); target uuid; blocked_until timestamptz;
  previous_target uuid; previous_blocked_until timestamptz;
begin
  if not private.current_user_has_role('system_administrator'::public.app_role) then raise exception 'System Administrator access is required.' using errcode = '42501'; end if;
  if requested_action = 'reset' then
    select target_user_id, profile.applicant_cooling_off_ends_at into target, blocked_until from public.applicant_login_presentation_demo demo left join public.profiles profile on profile.id = demo.target_user_id where demo.id;
    update public.applicant_login_presentation_demo set target_user_id = null, simulated_at = null, expires_at = null, updated_by_user_id = caller, updated_at = now() where id;
    if target is not null and blocked_until > now() then update auth.users set banned_until = blocked_until where id = target; end if;
    insert into public.audit_logs(actor_user_id, entity_type, entity_id, action) values (caller, 'applicant_login_presentation_demo', coalesce(target::text, 'none'), 'reset');
    return;
  end if;
  if requested_action <> 'start' then raise exception 'Choose start or reset.' using errcode = '22023'; end if;
  select demo.target_user_id, profile.applicant_cooling_off_ends_at into previous_target, previous_blocked_until
  from public.applicant_login_presentation_demo demo
  left join public.profiles profile on profile.id = demo.target_user_id
  where demo.id;
  select profile.id, profile.applicant_cooling_off_ends_at into target, blocked_until from public.profiles profile join public.user_roles role on role.user_id = profile.id and role.role = 'applicant'::public.app_role where lower(profile.email) = lower(btrim(target_email));
  if target is null or blocked_until is null or blocked_until <= now() then raise exception 'Choose an applicant currently in the cooling-off period.' using errcode = 'P0001'; end if;
  insert into public.applicant_login_presentation_demo(id, target_user_id, simulated_at, expires_at, updated_by_user_id, updated_at) values (true, target, blocked_until, now() + interval '30 minutes', caller, now())
  on conflict (id) do update set target_user_id = excluded.target_user_id, simulated_at = excluded.simulated_at, expires_at = excluded.expires_at, updated_by_user_id = excluded.updated_by_user_id, updated_at = excluded.updated_at;
  if previous_target is not null and previous_target <> target and previous_blocked_until > now() then
    update auth.users set banned_until = previous_blocked_until where id = previous_target;
  end if;
  update auth.users set banned_until = null where id = target;
  insert into public.audit_logs(actor_user_id, entity_type, entity_id, action, metadata) values (caller, 'applicant_login_presentation_demo', target::text, 'started', jsonb_build_object('expires_at', now() + interval '30 minutes'));
end;
$$;
revoke all on function public.get_applicant_login_presentation_demo(), public.set_applicant_login_presentation_demo(text, text) from public, anon;
grant execute on function public.get_applicant_login_presentation_demo(), public.set_applicant_login_presentation_demo(text, text) to authenticated;
