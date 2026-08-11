alter table public.positions
  add column code text,
  add column description text;

alter table public.positions
  add constraint positions_code_format_check
  check (
    code is null
    or (
      code = btrim(code)
      and char_length(code) between 1 and 32
    )
  ),
  add constraint positions_description_length_check
  check (description is null or char_length(description) <= 1000);

create unique index positions_code_unique_idx
  on public.positions (lower(code))
  where code is not null;

create table public.organization_settings (
  id boolean primary key default true check (id),
  organization_name text not null check (char_length(btrim(organization_name)) between 2 and 160),
  support_email text not null check (char_length(btrim(support_email)) between 3 and 320),
  default_timezone text not null check (char_length(btrim(default_timezone)) between 1 and 64),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.organization_settings enable row level security;

grant select, insert, update on public.organization_settings to authenticated;

create policy organization_settings_select_admin
  on public.organization_settings for select to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy organization_settings_insert_admin
  on public.organization_settings for insert to authenticated
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy organization_settings_update_admin
  on public.organization_settings for update to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)))
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create trigger organization_settings_touch_updated_at
  before update on public.organization_settings
  for each row execute procedure private.touch_updated_at();

create trigger organization_settings_write_audit_log
  after insert or update on public.organization_settings
  for each row execute procedure private.audit_privileged_change();

create or replace function private.audit_profile_activation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active is distinct from new.is_active then
    insert into public.audit_logs (
      actor_user_id,
      entity_type,
      entity_id,
      action,
      metadata
    )
    values (
      (select auth.uid()),
      'profiles',
      new.id::text,
      'activation_changed',
      jsonb_build_object(
        'previous_is_active', old.is_active,
        'is_active', new.is_active
      )
    );
  end if;

  return new;
end;
$$;

create trigger profiles_write_activation_audit_log
  after update of is_active on public.profiles
  for each row execute procedure private.audit_profile_activation_change();

drop policy profiles_update_admin on public.profiles;
drop policy user_roles_update_admin on public.user_roles;

drop policy audit_logs_select_hr_or_admin on public.audit_logs;

create policy audit_logs_select_admin
  on public.audit_logs for select to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)));

create or replace function private.update_managed_user(
  target_user_id uuid,
  next_role public.app_role,
  next_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_current_role public.app_role;
  current_is_active boolean;
  active_administrator_count integer;
begin
  if actor_user_id is null
     or not exists (
       select 1
       from public.user_roles user_role
       inner join public.profiles profile on profile.id = user_role.user_id
       where user_role.user_id = actor_user_id
         and user_role.role = 'system_administrator'::public.app_role
         and profile.is_active
     ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  lock table public.user_roles, public.profiles in share row exclusive mode;

  select role into target_current_role
  from public.user_roles
  where user_id = target_user_id;

  select is_active into current_is_active
  from public.profiles
  where id = target_user_id;

  if target_current_role is null or current_is_active is null then
    raise exception 'Managed account was not found.' using errcode = 'P0001';
  end if;

  if target_user_id = actor_user_id
     and (
       next_role <> 'system_administrator'::public.app_role
       or not next_is_active
     ) then
    raise exception 'Administrators cannot remove their own administrator role or deactivate themselves.'
      using errcode = 'P0001';
  end if;

  if target_current_role = 'system_administrator'::public.app_role
     and current_is_active
     and (
       next_role <> 'system_administrator'::public.app_role
       or not next_is_active
     ) then
    select count(*) into active_administrator_count
    from public.user_roles user_role
    inner join public.profiles profile on profile.id = user_role.user_id
    where user_role.role = 'system_administrator'::public.app_role
      and profile.is_active;

    if active_administrator_count = 1 then
      raise exception 'At least one active system administrator is required.'
        using errcode = 'P0001';
    end if;
  end if;

  update public.user_roles
  set
    role = next_role,
    assigned_by = actor_user_id,
    assigned_at = now()
  where user_id = target_user_id
    and role is distinct from next_role;

  update public.profiles
  set is_active = next_is_active
  where id = target_user_id
    and is_active is distinct from next_is_active;
end;
$$;

revoke all on function private.update_managed_user(uuid, public.app_role, boolean)
  from public, anon, authenticated;

create or replace function public.update_managed_user(
  target_user_id uuid,
  next_role public.app_role,
  next_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.update_managed_user(target_user_id, next_role, next_is_active);
end;
$$;

revoke all on function public.update_managed_user(uuid, public.app_role, boolean)
  from public, anon;
grant execute on function public.update_managed_user(uuid, public.app_role, boolean)
  to authenticated;
