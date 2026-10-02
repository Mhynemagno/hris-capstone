-- Tester feedback (October 2026): deployments record a Deployment Type and an Event / Operation,
-- and the status is one of Scheduled, Ongoing, Completed or Cancelled.
--
-- 1. Two optional columns, deployment_type and event_operation, limited to the tester's options.
--    Existing deployments have neither; the form requires both from now on.
-- 2. Statuses: 'active' becomes 'scheduled' when the start date is still in the future (Manila time,
--    what the app showed as "Upcoming") and 'ongoing' otherwise; 'rejected' becomes 'cancelled'.
-- 3. The create / update RPCs take the two new fields and accept the new statuses.
-- 4. The dashboard "personnel deployed now" tile counts ongoing deployments, and employees are
--    notified of scheduled and ongoing deployments.

-- 1. Columns -------------------------------------------------------------------------------------
alter table public.deployments
  add column deployment_type text check (deployment_type in ('Public Assembly', 'Special Event', 'Election Security', 'Disaster Response')),
  add column event_operation text check (event_operation in ('Rally', 'Fiesta / Major Event', 'Election Period', 'Flood / Emergency', 'Government Event'));

-- 2. Statuses ------------------------------------------------------------------------------------
alter table public.deployments drop constraint deployments_status_check;

-- The original "completed needs an end date" check is dropped: the form does not ask for an end
-- date, so HR can mark a deployment Completed without one.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_catalog.pg_constraint
    where conrelid = 'public.deployments'::regclass and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%completed%'
  loop
    execute format('alter table public.deployments drop constraint %I', constraint_name);
  end loop;
end $$;

update public.deployments set status = case
  when status = 'active' and starts_on > (now() at time zone 'Asia/Manila')::date then 'scheduled'
  when status = 'active' then 'ongoing'
  else 'cancelled'
end;

alter table public.deployments
  add constraint deployments_status_check check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  alter column status set default 'scheduled';

drop index if exists public.deployments_active_employee_idx;
create index deployments_ongoing_employee_idx on public.deployments (employee_id, starts_on desc) where status = 'ongoing';

-- 3. RPCs ----------------------------------------------------------------------------------------
drop function public.create_deployment(uuid, text, text, text, text, date, date, text, text);
drop function public.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text);
drop function private.create_deployment(uuid, text, text, text, text, date, date, text, text);
drop function private.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text);

create function private.validate_deployment_fields(
  target_status text,
  target_starts_on date,
  target_ends_on date,
  target_deployment_type text,
  target_event_operation text
)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if target_status is null or target_status not in ('scheduled', 'ongoing', 'completed', 'cancelled') then
    raise exception 'Deployment status is invalid.' using errcode = '22023';
  end if;
  if target_deployment_type is not null and target_deployment_type not in ('Public Assembly', 'Special Event', 'Election Security', 'Disaster Response') then
    raise exception 'Deployment type is invalid.' using errcode = '22023';
  end if;
  if target_event_operation is not null and target_event_operation not in ('Rally', 'Fiesta / Major Event', 'Election Period', 'Flood / Emergency', 'Government Event') then
    raise exception 'Event / operation is invalid.' using errcode = '22023';
  end if;
  if target_ends_on is not null and target_ends_on < target_starts_on then
    raise exception 'End date must be on or after start date.' using errcode = '22007';
  end if;
end;
$$;

create function private.create_deployment(
  target_employee_id uuid,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text,
  target_deployment_type text,
  target_event_operation text
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
  perform private.validate_deployment_fields(target_status, target_starts_on, target_ends_on, target_deployment_type, target_event_operation);

  insert into public.deployments (
    employee_id, location, unit, project, assignment_role, starts_on, ends_on, status, notes,
    deployment_type, event_operation, created_by_user_id, updated_by_user_id
  ) values (
    target_employee_id, clean_location, clean_unit, clean_project, clean_assignment_role,
    target_starts_on, target_ends_on, target_status, clean_notes,
    target_deployment_type, target_event_operation, caller_id, caller_id
  ) returning * into new_deployment;

  insert into public.deployment_history (deployment_id, actor_user_id, event_type, metadata)
  values (
    new_deployment.id, caller_id, 'created',
    jsonb_build_object('after', jsonb_build_object(
      'location', new_deployment.location, 'unit', new_deployment.unit, 'project', new_deployment.project,
      'assignmentRole', new_deployment.assignment_role, 'startsOn', new_deployment.starts_on,
      'endsOn', new_deployment.ends_on, 'status', new_deployment.status, 'notes', new_deployment.notes,
      'deploymentType', new_deployment.deployment_type, 'eventOperation', new_deployment.event_operation
    ))
  );
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', new_deployment.id::text, 'created', jsonb_build_object('employee_id', target_employee_id));

  return new_deployment.id;
end;
$$;

create function private.update_deployment(
  target_deployment_id uuid,
  expected_updated_at timestamptz,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text,
  target_deployment_type text,
  target_event_operation text
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
  perform private.validate_deployment_fields(target_status, target_starts_on, target_ends_on, target_deployment_type, target_event_operation);

  update public.deployments set
    location = clean_location,
    unit = clean_unit,
    project = clean_project,
    assignment_role = clean_assignment_role,
    starts_on = target_starts_on,
    ends_on = target_ends_on,
    status = target_status,
    notes = clean_notes,
    deployment_type = target_deployment_type,
    event_operation = target_event_operation,
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
        'endsOn', previous_deployment.ends_on, 'status', previous_deployment.status, 'notes', previous_deployment.notes,
        'deploymentType', previous_deployment.deployment_type, 'eventOperation', previous_deployment.event_operation
      ),
      'after', jsonb_build_object(
        'location', updated_deployment.location, 'unit', updated_deployment.unit, 'project', updated_deployment.project,
        'assignmentRole', updated_deployment.assignment_role, 'startsOn', updated_deployment.starts_on,
        'endsOn', updated_deployment.ends_on, 'status', updated_deployment.status, 'notes', updated_deployment.notes,
        'deploymentType', updated_deployment.deployment_type, 'eventOperation', updated_deployment.event_operation
      )
    )
  );
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', updated_deployment.id::text, event_name, jsonb_build_object('employee_id', updated_deployment.employee_id));
end;
$$;

create function public.create_deployment(
  target_employee_id uuid,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text,
  target_deployment_type text,
  target_event_operation text
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  return private.create_deployment(target_employee_id, target_location, target_unit, target_project, target_assignment_role, target_starts_on, target_ends_on, target_status, target_notes, target_deployment_type, target_event_operation);
end;
$$;

create function public.update_deployment(
  target_deployment_id uuid,
  expected_updated_at timestamptz,
  target_location text,
  target_unit text,
  target_project text,
  target_assignment_role text,
  target_starts_on date,
  target_ends_on date,
  target_status text,
  target_notes text,
  target_deployment_type text,
  target_event_operation text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.update_deployment(target_deployment_id, expected_updated_at, target_location, target_unit, target_project, target_assignment_role, target_starts_on, target_ends_on, target_status, target_notes, target_deployment_type, target_event_operation);
end;
$$;

revoke all on function private.validate_deployment_fields(text, date, date, text, text) from public, anon, authenticated;
revoke all on function private.create_deployment(uuid, text, text, text, text, date, date, text, text, text, text), private.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_deployment(uuid, text, text, text, text, date, date, text, text, text, text), public.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text, text, text) from public, anon;
grant execute on function public.create_deployment(uuid, text, text, text, text, date, date, text, text, text, text), public.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text, text, text) to authenticated;

-- 4. Dashboards and notifications ----------------------------------------------------------------
do $$
declare
  target regprocedure;
  definition text;
  old_expression constant text := $expr$(select count(*) from public.deployments where status = 'active' and starts_on <= (now() at time zone 'Asia/Manila')::date)$expr$;
  new_expression constant text := $expr$(select count(*) from public.deployments where status = 'ongoing')$expr$;
begin
  foreach target in array array[
    'private.get_hr_dashboard_summary(date,date)'::regprocedure,
    'private.get_management_dashboard_summary(date,date)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    if position(old_expression in definition) = 0 then
      raise exception 'Expected deployed-now count not found in %', target;
    end if;
    execute replace(definition, old_expression, new_expression);
  end loop;

  definition := pg_get_functiondef('private.notify_deployment_assignment()'::regprocedure);
  if position($expr$if new.status <> 'active' then return new; end if;$expr$ in definition) = 0 then
    raise exception 'Expected deployment notification status check not found';
  end if;
  execute replace(definition, $expr$if new.status <> 'active' then return new; end if;$expr$, $expr$if new.status not in ('scheduled', 'ongoing') then return new; end if;$expr$);
end $$;
