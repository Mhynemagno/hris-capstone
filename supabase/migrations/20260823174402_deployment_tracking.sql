create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  location text check (location is null or (location = btrim(location) and char_length(location) between 1 and 200)),
  unit text check (unit is null or (unit = btrim(unit) and char_length(unit) between 1 and 200)),
  project text check (project is null or (project = btrim(project) and char_length(project) between 1 and 200)),
  assignment_role text not null check (assignment_role = btrim(assignment_role) and char_length(assignment_role) between 1 and 200),
  starts_on date not null,
  ends_on date,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  notes text check (notes is null or (notes = btrim(notes) and char_length(notes) <= 2000)),
  created_by_user_id uuid not null references public.profiles(id),
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (location is not null or unit is not null or project is not null),
  check (ends_on is null or ends_on >= starts_on),
  check (status <> 'completed' or ends_on is not null)
);

create table public.deployment_history (
  id bigint generated always as identity primary key,
  deployment_id uuid not null references public.deployments(id) on delete restrict,
  actor_user_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('created', 'updated', 'status_changed')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index deployments_active_employee_idx on public.deployments (employee_id, starts_on desc) where status = 'active';
create index deployments_date_range_idx on public.deployments (starts_on, ends_on);
create index deployment_history_deployment_created_idx on public.deployment_history (deployment_id, created_at asc);

alter table public.deployments enable row level security;
alter table public.deployment_history enable row level security;

revoke all on public.deployments, public.deployment_history from anon, authenticated;
grant select on public.deployments, public.deployment_history to authenticated;

create policy deployments_select_hr_or_own on public.deployments for select to authenticated using (
  (select private.current_user_has_role('hr_personnel'::public.app_role))
  or exists (
    select 1 from public.employees employee
    where employee.id = deployments.employee_id
      and employee.profile_id = (select auth.uid())
  )
);

create policy deployment_history_select_hr_or_own on public.deployment_history for select to authenticated using (
  (select private.current_user_has_role('hr_personnel'::public.app_role))
  or exists (
    select 1
    from public.deployments deployment
    join public.employees employee on employee.id = deployment.employee_id
    where deployment.id = deployment_history.deployment_id
      and employee.profile_id = (select auth.uid())
  )
);

create or replace function private.create_deployment(
  target_employee_id uuid,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  clean_location text := nullif(btrim(target_location), '');
  clean_unit text := nullif(btrim(target_unit), '');
  clean_project text := nullif(btrim(target_project), '');
  clean_assignment_role text := nullif(btrim(target_assignment_role), '');
  clean_notes text := nullif(btrim(target_notes), '');
  new_deployment public.deployments%rowtype;
begin
  if not exists (select 1 from public.employees where id = target_employee_id) then
    raise exception 'Employee was not found.' using errcode = 'P0001';
  end if;
  if clean_location is null and clean_unit is null and clean_project is null then
    raise exception 'Provide a location, unit, or project.' using errcode = '22023';
  end if;
  if clean_assignment_role is null or char_length(clean_assignment_role) > 200 then
    raise exception 'Assignment role is required and must be at most 200 characters.' using errcode = '22023';
  end if;
  if target_status not in ('planned', 'active', 'completed', 'cancelled') then
    raise exception 'Deployment status is invalid.' using errcode = '22023';
  end if;
  if target_ends_on is not null and target_ends_on < target_starts_on then
    raise exception 'End date must be on or after start date.' using errcode = '22007';
  end if;
  if target_status = 'completed' and target_ends_on is null then
    raise exception 'Completed deployments require an end date.' using errcode = '22007';
  end if;

  insert into public.deployments (
    employee_id, location, unit, project, assignment_role, starts_on, ends_on, status, notes,
    created_by_user_id, updated_by_user_id
  ) values (
    target_employee_id, clean_location, clean_unit, clean_project, clean_assignment_role,
    target_starts_on, target_ends_on, target_status, clean_notes, caller_id, caller_id
  ) returning * into new_deployment;

  insert into public.deployment_history (deployment_id, actor_user_id, event_type, metadata)
  values (
    new_deployment.id, caller_id, 'created',
    jsonb_build_object('after', jsonb_build_object(
      'location', new_deployment.location, 'unit', new_deployment.unit, 'project', new_deployment.project,
      'assignmentRole', new_deployment.assignment_role, 'startsOn', new_deployment.starts_on,
      'endsOn', new_deployment.ends_on, 'status', new_deployment.status, 'notes', new_deployment.notes
    ))
  );
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', new_deployment.id::text, 'created', jsonb_build_object('employee_id', target_employee_id));

  return new_deployment.id;
end;
$$;

create or replace function private.update_deployment(
  target_deployment_id uuid,
  expected_updated_at timestamptz,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  previous_deployment public.deployments%rowtype;
  updated_deployment public.deployments%rowtype;
  clean_location text := nullif(btrim(target_location), '');
  clean_unit text := nullif(btrim(target_unit), '');
  clean_project text := nullif(btrim(target_project), '');
  clean_assignment_role text := nullif(btrim(target_assignment_role), '');
  clean_notes text := nullif(btrim(target_notes), '');
  event_name text;
begin
  select * into previous_deployment from public.deployments where id = target_deployment_id for update;
  if not found then
    raise exception 'Deployment was not found.' using errcode = 'P0001';
  end if;
  if expected_updated_at is null or previous_deployment.updated_at <> expected_updated_at then
    raise exception 'This deployment changed. Refresh and try again.' using errcode = 'P0001';
  end if;
  if clean_location is null and clean_unit is null and clean_project is null then
    raise exception 'Provide a location, unit, or project.' using errcode = '22023';
  end if;
  if clean_assignment_role is null or char_length(clean_assignment_role) > 200 then
    raise exception 'Assignment role is required and must be at most 200 characters.' using errcode = '22023';
  end if;
  if target_status not in ('planned', 'active', 'completed', 'cancelled') then
    raise exception 'Deployment status is invalid.' using errcode = '22023';
  end if;
  if target_ends_on is not null and target_ends_on < target_starts_on then
    raise exception 'End date must be on or after start date.' using errcode = '22007';
  end if;
  if target_status = 'completed' and target_ends_on is null then
    raise exception 'Completed deployments require an end date.' using errcode = '22007';
  end if;

  update public.deployments set
    location = clean_location,
    unit = clean_unit,
    project = clean_project,
    assignment_role = clean_assignment_role,
    starts_on = target_starts_on,
    ends_on = target_ends_on,
    status = target_status,
    notes = clean_notes,
    updated_by_user_id = caller_id,
    updated_at = greatest(clock_timestamp(), previous_deployment.updated_at + interval '1 microsecond')
  where id = previous_deployment.id
  returning * into updated_deployment;

  event_name := case when previous_deployment.status is distinct from updated_deployment.status then 'status_changed' else 'updated' end;
  insert into public.deployment_history (deployment_id, actor_user_id, event_type, metadata)
  values (
    updated_deployment.id, caller_id, event_name,
    jsonb_build_object(
      'before', jsonb_build_object(
        'location', previous_deployment.location, 'unit', previous_deployment.unit, 'project', previous_deployment.project,
        'assignmentRole', previous_deployment.assignment_role, 'startsOn', previous_deployment.starts_on,
        'endsOn', previous_deployment.ends_on, 'status', previous_deployment.status, 'notes', previous_deployment.notes
      ),
      'after', jsonb_build_object(
        'location', updated_deployment.location, 'unit', updated_deployment.unit, 'project', updated_deployment.project,
        'assignmentRole', updated_deployment.assignment_role, 'startsOn', updated_deployment.starts_on,
        'endsOn', updated_deployment.ends_on, 'status', updated_deployment.status, 'notes', updated_deployment.notes
      )
    )
  );
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', updated_deployment.id::text, event_name, jsonb_build_object('employee_id', updated_deployment.employee_id));
end;
$$;

create or replace function public.create_deployment(
  target_employee_id uuid,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return private.create_deployment(target_employee_id, target_location, target_unit, target_project, target_assignment_role, target_starts_on, target_ends_on, target_status, target_notes);
end;
$$;

create or replace function public.update_deployment(
  target_deployment_id uuid,
  expected_updated_at timestamptz,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.update_deployment(target_deployment_id, expected_updated_at, target_location, target_unit, target_project, target_assignment_role, target_starts_on, target_ends_on, target_status, target_notes);
end;
$$;

revoke all on function private.create_deployment(uuid, text, text, text, text, date, date, text, text), private.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text) from public, anon, authenticated;
revoke all on function public.create_deployment(uuid, text, text, text, text, date, date, text, text), public.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text) from public, anon;
grant execute on function public.create_deployment(uuid, text, text, text, text, date, date, text, text), public.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text) to authenticated;
