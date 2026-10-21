-- Final PDF deployment revisions: one header can assign multiple employees.
-- Generated manually because the Supabase CLI is not installed on this host; keep this
-- forward-only migration after the existing deployment and proof-upload migrations.

create table public.deployment_groups (
  id uuid primary key default gen_random_uuid(),
  location text not null check (location = btrim(location) and char_length(location) between 1 and 200),
  unit text null check (unit is null or (unit = btrim(unit) and char_length(unit) between 1 and 200)),
  starts_on date not null,
  ends_on date null check (ends_on is null or ends_on >= starts_on),
  deployment_type text not null check (deployment_type in ('Public Assembly', 'Special Event', 'Election Security', 'Disaster Response')),
  event_operation text not null check (event_operation in ('Rally', 'Fiesta / Major Event', 'Election Period', 'Flood / Emergency', 'Government Event')),
  created_by_user_id uuid null references public.profiles(id) on delete set null,
  updated_by_user_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deployment_assignments (
  id uuid primary key default gen_random_uuid(),
  deployment_group_id uuid not null references public.deployment_groups(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  task text not null check (task in ('Deployed', 'Reserve/Standby')),
  status text not null default 'scheduled' check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  employee_reported_status text null check (employee_reported_status in ('completed')),
  review_status text not null default 'not_submitted' check (review_status in ('not_submitted', 'for_approval', 'approved', 'rejected')),
  reviewed_by_user_id uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deployment_group_id, employee_id)
);

create index deployment_assignments_employee_status_idx on public.deployment_assignments (employee_id, status, deployment_group_id);
create index deployment_groups_date_idx on public.deployment_groups (starts_on, ends_on);

alter table public.deployment_groups enable row level security;
alter table public.deployment_assignments enable row level security;

create function private.can_access_deployment_group(target_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.current_user_has_role('hr_personnel'::public.app_role))
    or exists (
      select 1
      from public.deployment_assignments assignment
      join public.employees employee on employee.id = assignment.employee_id
      where assignment.deployment_group_id = target_group_id
        and employee.profile_id = (select auth.uid())
    )
$$;

create policy deployment_groups_select_hr_or_assigned
  on public.deployment_groups for select to authenticated
  using ((select private.can_access_deployment_group(id)));

create policy deployment_assignments_select_hr_or_own
  on public.deployment_assignments for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or exists (select 1 from public.employees employee where employee.id = employee_id and employee.profile_id = (select auth.uid()))
  );

revoke all on public.deployment_groups, public.deployment_assignments from anon, authenticated;
grant select on public.deployment_groups, public.deployment_assignments to authenticated;

create function private.deployment_event_matches_type(target_type text, target_event text)
returns boolean language sql immutable set search_path = '' as $$
  select (target_type = 'Public Assembly' and target_event in ('Rally', 'Fiesta / Major Event', 'Government Event'))
      or (target_type = 'Special Event' and target_event in ('Fiesta / Major Event', 'Government Event'))
      or (target_type = 'Election Security' and target_event = 'Election Period')
      or (target_type = 'Disaster Response' and target_event = 'Flood / Emergency')
$$;

create function public.create_deployment_group(
  target_location text,
  target_unit text,
  target_starts_on date,
  target_ends_on date,
  target_deployment_type text,
  target_event_operation text,
  target_assignments jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_location text := nullif(btrim(target_location), '');
  clean_unit text := nullif(btrim(target_unit), '');
  group_id uuid;
  item jsonb;
  assigned_employee_id uuid;
  assigned_task text;
begin
  if clean_location is null or target_starts_on is null or target_assignments is null or jsonb_typeof(target_assignments) <> 'array' or jsonb_array_length(target_assignments) = 0 then
    raise exception 'Location, start date, and at least one employee are required.' using errcode = '22023';
  end if;
  if target_ends_on is not null and target_ends_on < target_starts_on then
    raise exception 'End date must be on or after start date.' using errcode = '22007';
  end if;
  if not private.deployment_event_matches_type(target_deployment_type, target_event_operation) then
    raise exception 'Event / operation does not match the deployment type.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(target_assignments) as item(value)
    group by value ->> 'employeeId' having count(*) > 1
  ) then
    raise exception 'Each employee can only be selected once.' using errcode = '22023';
  end if;

  insert into public.deployment_groups (location, unit, starts_on, ends_on, deployment_type, event_operation, created_by_user_id, updated_by_user_id)
  values (clean_location, clean_unit, target_starts_on, target_ends_on, target_deployment_type, target_event_operation, caller_id, caller_id)
  returning id into group_id;

  for item in select value from jsonb_array_elements(target_assignments)
  loop
    assigned_employee_id := (item ->> 'employeeId')::uuid;
    assigned_task := item ->> 'task';
    if assigned_task not in ('Deployed', 'Reserve/Standby') then
      raise exception 'Deployment task is invalid.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.employees employee where employee.id = assigned_employee_id and employee.employment_status = 'active') then
      raise exception 'Deployment employees must be active personnel.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.leave_requests leave_request
      where leave_request.employee_id = assigned_employee_id and leave_request.status = 'approved'
        and leave_request.starts_on <= coalesce(target_ends_on, target_starts_on)
        and leave_request.ends_on >= target_starts_on
    ) then
      raise exception 'An employee on approved leave cannot be deployed.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.deployment_assignments assignment
      join public.deployment_groups existing_group on existing_group.id = assignment.deployment_group_id
      where assignment.employee_id = assigned_employee_id and assignment.status <> 'cancelled'
        and existing_group.starts_on <= coalesce(target_ends_on, target_starts_on)
        and coalesce(existing_group.ends_on, existing_group.starts_on) >= target_starts_on
    ) then
      raise exception 'An employee already has an overlapping deployment.' using errcode = '22023';
    end if;
    insert into public.deployment_assignments (deployment_group_id, employee_id, task)
    values (group_id, assigned_employee_id, assigned_task);

    -- Keep one legacy deployment per assignment while the employee portal and
    -- proof-of-attendance tables remain keyed to deployments.id. This makes a
    -- grouped assignment immediately visible and reportable by its employee.
    insert into public.deployments (
      employee_id, location, unit, project, assignment_role, starts_on, ends_on,
      status, notes, deployment_type, event_operation, created_by_user_id, updated_by_user_id
    ) values (
      assigned_employee_id, clean_location, clean_unit, null, assigned_task, target_starts_on, target_ends_on,
      'scheduled', 'Grouped deployment assignment: ' || assigned_task, target_deployment_type, target_event_operation, caller_id, caller_id
    );
  end loop;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployment_group', group_id::text, 'created', jsonb_build_object('assignment_count', jsonb_array_length(target_assignments)));
  return group_id;
end;
$$;

revoke all on function private.can_access_deployment_group(uuid), private.deployment_event_matches_type(text, text) from public, anon, authenticated;
grant execute on function private.can_access_deployment_group(uuid) to authenticated;
revoke all on function public.create_deployment_group(text, text, date, date, text, text, jsonb) from public, anon;
grant execute on function public.create_deployment_group(text, text, date, date, text, text, jsonb) to authenticated;
