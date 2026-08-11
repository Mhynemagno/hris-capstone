create extension if not exists pgtap with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum (
  'system_administrator',
  'hr_personnel',
  'applicant',
  'employee',
  'management'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now()
);

create table public.departments (
  id bigint generated always as identity primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.positions (
  id bigint generated always as identity primary key,
  department_id bigint references public.departments (id) on delete set null,
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (department_id, title)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index user_roles_role_idx on public.user_roles (role);
create index positions_department_id_idx on public.positions (department_id);
create index audit_logs_actor_user_id_created_at_idx
  on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_entity_created_at_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create or replace function private.current_user_has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_roles
      where user_id = (select auth.uid())
        and role = required_role
    );
$$;

revoke all on function private.current_user_has_role(public.app_role)
  from public, anon, service_role;
grant execute on function private.current_user_has_role(public.app_role)
  to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'applicant'::public.app_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.audit_privileged_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb;
  changed_id text;
begin
  changed_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  changed_id := changed_row ->> 'id';

  insert into public.audit_logs (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    (select auth.uid()),
    tg_table_name,
    changed_id,
    lower(tg_op),
    changed_row - 'assigned_by'
  );

  return coalesce(new, old);
end;
$$;

insert into public.profiles (id, email, full_name)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select id, 'applicant'::public.app_role
from auth.users
on conflict (user_id) do nothing;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure private.touch_updated_at();

create trigger departments_touch_updated_at
  before update on public.departments
  for each row execute procedure private.touch_updated_at();

create trigger positions_touch_updated_at
  before update on public.positions
  for each row execute procedure private.touch_updated_at();

create trigger user_roles_write_audit_log
  after insert or update or delete on public.user_roles
  for each row execute procedure private.audit_privileged_change();

create trigger departments_write_audit_log
  after insert or update or delete on public.departments
  for each row execute procedure private.audit_privileged_change();

create trigger positions_write_audit_log
  after insert or update or delete on public.positions
  for each row execute procedure private.audit_privileged_change();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.user_roles to authenticated;
grant select, insert, update on public.departments to authenticated;
grant select, insert, update on public.positions to authenticated;
grant select on public.audit_logs to authenticated;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_select_hr_or_admin
  on public.profiles for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  );

create policy profiles_update_admin
  on public.profiles for update to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)))
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy user_roles_select_own
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy user_roles_select_admin
  on public.user_roles for select to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy user_roles_update_admin
  on public.user_roles for update to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)))
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy departments_select_authenticated
  on public.departments for select to authenticated
  using (true);

create policy departments_insert_admin
  on public.departments for insert to authenticated
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy departments_update_admin
  on public.departments for update to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)))
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy positions_select_authenticated
  on public.positions for select to authenticated
  using (true);

create policy positions_insert_admin
  on public.positions for insert to authenticated
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy positions_update_admin
  on public.positions for update to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)))
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy audit_logs_select_hr_or_admin
  on public.audit_logs for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('private-documents', 'private-documents', false, 52428800)
on conflict (id) do nothing;

create policy private_documents_admin_manage
  on storage.objects for all to authenticated
  using (
    bucket_id = 'private-documents'
    and (select private.current_user_has_role('system_administrator'::public.app_role))
  )
  with check (
    bucket_id = 'private-documents'
    and (select private.current_user_has_role('system_administrator'::public.app_role))
  );
