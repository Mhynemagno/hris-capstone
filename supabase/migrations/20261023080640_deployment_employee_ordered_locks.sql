-- Lock every employee in the same order before availability is evaluated.
create function private.lock_deployment_employees(target_assignments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare employee_id uuid;
begin
  for employee_id in
    select distinct (assignment.value ->> 'employeeId')::uuid
    from jsonb_array_elements(target_assignments) as assignment(value)
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(employee_id::text, 0));
  end loop;
end;
$$;

create or replace function public.create_deployment_group(
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

  perform private.lock_deployment_employees(target_assignments);

  insert into public.deployment_groups (location, unit, starts_on, ends_on, deployment_type, event_operation, created_by_user_id, updated_by_user_id)
  values (clean_location, clean_unit, target_starts_on, target_ends_on, target_deployment_type, target_event_operation, caller_id, caller_id)
  returning id into group_id;

  for item in select value from jsonb_array_elements(target_assignments)
  loop
    assigned_employee_id := (item ->> 'employeeId')::uuid;
    assigned_task := item ->> 'task';
    if assigned_task is null or assigned_task not in ('Deployed', 'Reserve/Standby') then
      raise exception 'Deployment task is invalid.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.employees employee
      join public.ranks rank on rank.id = employee.rank_id
      where employee.id = assigned_employee_id and rank.code = 'NUP'
    ) then
      raise exception 'NUP personnel cannot be assigned to deployments.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.employees employee where employee.id = assigned_employee_id and employee.employment_status = 'active') then
      raise exception 'Deployment employees must be active personnel.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.deployments existing
      where existing.employee_id = assigned_employee_id and existing.status in ('scheduled', 'ongoing')
    ) then
      raise exception 'An employee already has a scheduled or ongoing deployment.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.leave_requests leave_request
      where leave_request.employee_id = assigned_employee_id and leave_request.status = 'approved'
        and leave_request.starts_on <= coalesce(target_ends_on, target_starts_on)
        and leave_request.ends_on >= target_starts_on
    ) then
      raise exception 'An employee on approved leave cannot be deployed.' using errcode = '22023';
    end if;
    insert into public.deployment_assignments (deployment_group_id, employee_id, task)
    values (group_id, assigned_employee_id, assigned_task);
    insert into public.deployments (
      employee_id, location, unit, project, assignment_role, task, deployment_group_id, starts_on, ends_on,
      status, notes, deployment_type, event_operation, created_by_user_id, updated_by_user_id
    ) values (
      assigned_employee_id, clean_location, clean_unit, null, assigned_task, assigned_task, group_id, target_starts_on, target_ends_on,
      'scheduled', null, target_deployment_type, target_event_operation, caller_id, caller_id
    );
  end loop;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployment_group', group_id::text, 'created', jsonb_build_object('assignment_count', jsonb_array_length(target_assignments)));
  return group_id;
end;
$$;

revoke all on function private.lock_deployment_employees(jsonb) from public, anon, authenticated;
revoke all on function public.create_deployment_group(text, text, date, date, text, text, jsonb) from public, anon;
grant execute on function public.create_deployment_group(text, text, date, date, text, text, jsonb) to authenticated;
