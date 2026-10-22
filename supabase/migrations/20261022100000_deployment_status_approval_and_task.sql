-- Final revisions audit (workstream A, Deployment).
-- * Each deployments row is the per-employee assignment; it now stores its own task
--   ("Deployed" / "Reserve/Standby") and the group header it was created with.
-- * HR can no longer set Ongoing / Completed directly. The deployed employee proposes
--   the status (Completed needs submitted proof), HR approves or rejects it, and HR's
--   only direct status action is Cancel.
-- * Remarks are no longer collected; the generated "Grouped deployment assignment" note
--   is removed.
-- * Event / operation is partitioned by deployment type and enforced on update too.
-- Forward-only: earlier deployment migrations are left untouched.

-- 1. Columns ------------------------------------------------------------------

alter table public.deployments
  add column task text not null default 'Deployed' check (task in ('Deployed', 'Reserve/Standby')),
  add column deployment_group_id uuid null references public.deployment_groups(id) on delete set null,
  add column proposed_status text null check (proposed_status in ('ongoing', 'completed')),
  add column proposed_at timestamptz null,
  add column status_reviewed_at timestamptz null,
  add column status_reviewed_by_user_id uuid null references public.profiles(id) on delete set null;

create index deployments_deployment_group_id_idx on public.deployments (deployment_group_id);
create index deployments_status_reviewed_by_user_id_idx on public.deployments (status_reviewed_by_user_id);
create index deployments_proposed_status_idx on public.deployments (proposed_status) where proposed_status is not null;

-- Backfill. None of these updates touch location, dates, status or unit, so the
-- notification, overlap and unit-station triggers leave the rows alone.
update public.deployments
set task = assignment_role
where assignment_role in ('Deployed', 'Reserve/Standby') and task <> assignment_role;

update public.deployments deployment
set deployment_group_id = matched.deployment_group_id
from (
  select distinct on (assignment.employee_id, header.location, header.starts_on, header.ends_on, header.deployment_type, header.event_operation)
    assignment.deployment_group_id, assignment.employee_id, header.location, header.starts_on, header.ends_on, header.deployment_type, header.event_operation
  from public.deployment_assignments assignment
  join public.deployment_groups header on header.id = assignment.deployment_group_id
  order by assignment.employee_id, header.location, header.starts_on, header.ends_on, header.deployment_type, header.event_operation, assignment.created_at desc
) matched
where deployment.deployment_group_id is null
  and deployment.employee_id = matched.employee_id
  and deployment.location is not distinct from matched.location
  and deployment.starts_on = matched.starts_on
  and deployment.ends_on is not distinct from matched.ends_on
  and deployment.deployment_type is not distinct from matched.deployment_type
  and deployment.event_operation is not distinct from matched.event_operation;

update public.deployments
set notes = null
where notes like 'Grouped deployment assignment:%';

-- 2. Event / operation partition ------------------------------------------------

create or replace function private.deployment_event_matches_type(target_type text, target_event text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
       (target_type = 'Public Assembly' and target_event = 'Rally')
    or (target_type = 'Special Event' and target_event in ('Fiesta / Major Event', 'Government Event'))
    or (target_type = 'Election Security' and target_event = 'Election Period')
    or (target_type = 'Disaster Response' and target_event = 'Flood / Emergency'),
    false)
$$;

-- 3. Keep the grouped assignment row in step with its deployment -----------------

create or replace function private.sync_deployment_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deployment_group_id is null then
    return new;
  end if;
  if (new.status, new.task, new.proposed_status, new.status_reviewed_at)
     is not distinct from (old.status, old.task, old.proposed_status, old.status_reviewed_at) then
    return new;
  end if;

  update public.deployment_assignments assignment set
    status = new.status,
    task = new.task,
    employee_reported_status = case when new.proposed_status = 'completed' then 'completed' else assignment.employee_reported_status end,
    review_status = case
      when new.proposed_status is not null then 'for_approval'
      when old.proposed_status is not null and new.status_reviewed_at is distinct from old.status_reviewed_at
        then case when new.status = old.proposed_status then 'approved' else 'rejected' end
      else assignment.review_status
    end,
    reviewed_by_user_id = coalesce(new.status_reviewed_by_user_id, assignment.reviewed_by_user_id),
    reviewed_at = coalesce(new.status_reviewed_at, assignment.reviewed_at),
    updated_at = now()
  where assignment.deployment_group_id = new.deployment_group_id
    and assignment.employee_id = new.employee_id;
  return new;
end;
$$;

create trigger deployments_sync_assignment
  after update on public.deployments
  for each row execute function private.sync_deployment_assignment();

-- Status changes now send their own, specific notifications from the RPCs below, so
-- the generic "Deployment updated" message only covers new duty and moved duty.
create or replace function private.notify_deployment_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
begin
  if tg_op = 'UPDATE'
    and new.location is not distinct from old.location
    and new.starts_on is not distinct from old.starts_on then
    return new;
  end if;

  select employee.profile_id into recipient from public.employees employee where employee.id = new.employee_id;
  if recipient is null then return new; end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    recipient,
    case when tg_op = 'INSERT' then 'deployment_assigned' else 'deployment_updated' end,
    case when tg_op = 'INSERT' then 'New deployment assigned' else 'Deployment updated' end,
    format('You are deployed to %s starting %s.',
      coalesce(nullif(btrim(new.location), ''), nullif(btrim(new.unit), ''), 'a new assignment'),
      to_char(new.starts_on, 'FMMonth FMDD, YYYY')),
    '/employee/deployments'
  );
  return new;
end;
$$;

revoke all on function private.sync_deployment_assignment() from public, anon, authenticated;

-- 4. Grouped creation: task, header id, no generated note -----------------------

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
    -- Overlap is judged on the per-employee deployments; cancelled and completed duty is free time.
    if exists (
      select 1 from public.deployments existing
      where existing.employee_id = assigned_employee_id and existing.status in ('scheduled', 'ongoing')
        and existing.starts_on <= coalesce(target_ends_on, target_starts_on)
        and coalesce(existing.ends_on, existing.starts_on) >= target_starts_on
    ) then
      raise exception 'An employee already has an overlapping deployment.' using errcode = '22023';
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

-- 5. HR edits details (never the status) ---------------------------------------

create function public.update_deployment_details(
  target_deployment_id uuid,
  expected_updated_at timestamptz,
  target_location text,
  target_starts_on date,
  target_ends_on date,
  target_deployment_type text,
  target_event_operation text,
  target_task text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  previous_deployment public.deployments%rowtype;
  updated_deployment public.deployments%rowtype;
  clean_location text := nullif(btrim(target_location), '');
begin
  select * into previous_deployment from public.deployments where id = target_deployment_id for update;
  if not found then
    raise exception 'Deployment was not found.' using errcode = 'P0001';
  end if;
  if expected_updated_at is null or previous_deployment.updated_at <> expected_updated_at then
    raise exception 'This deployment changed. Refresh and try again.' using errcode = 'P0001';
  end if;
  if clean_location is null or char_length(clean_location) > 200 then
    raise exception 'Location is required and must be at most 200 characters.' using errcode = '22023';
  end if;
  if target_starts_on is null then
    raise exception 'Start date is required.' using errcode = '22023';
  end if;
  if target_ends_on is not null and target_ends_on < target_starts_on then
    raise exception 'End date must be on or after start date.' using errcode = '22007';
  end if;
  if target_task is null or target_task not in ('Deployed', 'Reserve/Standby') then
    raise exception 'Deployment task is invalid.' using errcode = '22023';
  end if;
  if not private.deployment_event_matches_type(target_deployment_type, target_event_operation) then
    raise exception 'Event / operation does not match the deployment type.' using errcode = '22023';
  end if;
  if previous_deployment.status in ('scheduled', 'ongoing')
    and (target_starts_on, target_ends_on) is distinct from (previous_deployment.starts_on, previous_deployment.ends_on)
    and exists (
      select 1 from public.leave_requests leave_request
      where leave_request.employee_id = previous_deployment.employee_id and leave_request.status = 'approved'
        and leave_request.starts_on <= coalesce(target_ends_on, target_starts_on)
        and leave_request.ends_on >= target_starts_on
    ) then
    raise exception 'An employee on approved leave cannot be deployed.' using errcode = '22023';
  end if;

  update public.deployments set
    location = clean_location,
    assignment_role = target_task,
    task = target_task,
    starts_on = target_starts_on,
    ends_on = target_ends_on,
    deployment_type = target_deployment_type,
    event_operation = target_event_operation,
    updated_by_user_id = caller_id,
    updated_at = greatest(clock_timestamp(), previous_deployment.updated_at + interval '1 microsecond')
  where id = previous_deployment.id
  returning * into updated_deployment;

  insert into public.deployment_history (deployment_id, actor_user_id, event_type, metadata)
  values (
    updated_deployment.id, caller_id, 'updated',
    jsonb_build_object(
      'before', jsonb_build_object(
        'location', previous_deployment.location, 'task', previous_deployment.task, 'startsOn', previous_deployment.starts_on,
        'endsOn', previous_deployment.ends_on, 'deploymentType', previous_deployment.deployment_type, 'eventOperation', previous_deployment.event_operation
      ),
      'after', jsonb_build_object(
        'location', updated_deployment.location, 'task', updated_deployment.task, 'startsOn', updated_deployment.starts_on,
        'endsOn', updated_deployment.ends_on, 'deploymentType', updated_deployment.deployment_type, 'eventOperation', updated_deployment.event_operation
      )
    )
  );
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', updated_deployment.id::text, 'updated', jsonb_build_object('employee_id', updated_deployment.employee_id, 'task', updated_deployment.task));
end;
$$;

-- 6. HR cancels -------------------------------------------------------------------

create function private.notify_deployment_employee(target_deployment public.deployments, target_title text, target_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
begin
  select employee.profile_id into recipient from public.employees employee where employee.id = target_deployment.employee_id;
  if recipient is null then return; end if;
  -- 'deployment_updated' reuses the existing deployment e-mail template.
  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (recipient, 'deployment_updated', target_title, target_body, '/employee/deployments');
end;
$$;

create function public.cancel_deployment(target_deployment_id uuid, expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  previous_deployment public.deployments%rowtype;
  updated_deployment public.deployments%rowtype;
begin
  select * into previous_deployment from public.deployments where id = target_deployment_id for update;
  if not found then
    raise exception 'Deployment was not found.' using errcode = 'P0001';
  end if;
  if expected_updated_at is null or previous_deployment.updated_at <> expected_updated_at then
    raise exception 'This deployment changed. Refresh and try again.' using errcode = 'P0001';
  end if;
  if previous_deployment.status not in ('scheduled', 'ongoing') then
    raise exception 'Only scheduled or ongoing deployments can be cancelled.' using errcode = '22023';
  end if;

  update public.deployments set
    status = 'cancelled',
    proposed_status = null,
    proposed_at = null,
    updated_by_user_id = caller_id,
    updated_at = greatest(clock_timestamp(), previous_deployment.updated_at + interval '1 microsecond')
  where id = previous_deployment.id
  returning * into updated_deployment;

  insert into public.deployment_history (deployment_id, actor_user_id, event_type, metadata)
  values (updated_deployment.id, caller_id, 'status_changed', jsonb_build_object('before', jsonb_build_object('status', previous_deployment.status), 'after', jsonb_build_object('status', 'cancelled')));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', updated_deployment.id::text, 'cancelled', jsonb_build_object('employee_id', updated_deployment.employee_id, 'previous_status', previous_deployment.status));
  perform private.notify_deployment_employee(
    updated_deployment, 'Deployment cancelled',
    format('Your deployment to %s starting %s was cancelled.', coalesce(updated_deployment.location, 'your assignment'), to_char(updated_deployment.starts_on, 'FMMonth FMDD, YYYY'))
  );
end;
$$;

-- 7. Employee proposes Ongoing / Completed --------------------------------------

create function public.propose_deployment_status(target_deployment_id uuid, target_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  current_deployment public.deployments%rowtype;
  hr_user record;
begin
  select deployment.* into current_deployment
  from public.deployments deployment
  join public.employees employee on employee.id = deployment.employee_id
  where deployment.id = target_deployment_id and caller_id is not null and employee.profile_id = caller_id
  for update of deployment;
  if not found then
    raise exception 'Only the assigned employee can update this deployment status.' using errcode = '42501';
  end if;
  if target_status is null or target_status not in ('ongoing', 'completed') then
    raise exception 'Choose Ongoing or Completed.' using errcode = '22023';
  end if;
  if current_deployment.status in ('cancelled', 'completed') then
    raise exception 'This deployment is already closed.' using errcode = '22023';
  end if;
  if current_deployment.status = target_status then
    raise exception 'The deployment already has this status.' using errcode = '22023';
  end if;
  if target_status = 'completed' and not exists (select 1 from public.deployment_reports report where report.deployment_id = current_deployment.id) then
    raise exception 'Submit a report or proof of attendance before marking the deployment as completed.' using errcode = '22023';
  end if;

  update public.deployments set
    proposed_status = target_status,
    proposed_at = now(),
    updated_at = greatest(clock_timestamp(), current_deployment.updated_at + interval '1 microsecond')
  where id = current_deployment.id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', current_deployment.id::text, 'status_proposed', jsonb_build_object('proposed_status', target_status));

  for hr_user in
    select role.user_id from public.user_roles role join public.profiles profile on profile.id = role.user_id
    where role.role = 'hr_personnel'::public.app_role and profile.is_active
  loop
    insert into public.notifications (recipient_user_id, type, title, body, link)
    values (hr_user.user_id, 'deployment_status_proposed', 'Deployment status for approval',
      format('A deployed employee marked the deployment to %s as %s.', coalesce(current_deployment.location, 'an assignment'), initcap(target_status)),
      '/hr/deployments/' || current_deployment.id::text);
  end loop;
end;
$$;

-- 8. HR approves or rejects the proposal ------------------------------------------

create function public.review_deployment_status(target_deployment_id uuid, approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := private.require_active_hr();
  previous_deployment public.deployments%rowtype;
  updated_deployment public.deployments%rowtype;
  status_label text;
begin
  if approve is null then
    raise exception 'Choose approve or reject.' using errcode = '22023';
  end if;
  select * into previous_deployment from public.deployments where id = target_deployment_id for update;
  if not found then
    raise exception 'Deployment was not found.' using errcode = 'P0001';
  end if;
  if previous_deployment.proposed_status is null then
    raise exception 'There is no status update waiting for approval.' using errcode = '22023';
  end if;
  if previous_deployment.status in ('cancelled', 'completed') then
    raise exception 'This deployment is already closed.' using errcode = '22023';
  end if;

  update public.deployments set
    status = case when approve then previous_deployment.proposed_status else status end,
    proposed_status = null,
    proposed_at = null,
    status_reviewed_at = clock_timestamp(),
    status_reviewed_by_user_id = caller_id,
    updated_by_user_id = caller_id,
    updated_at = greatest(clock_timestamp(), previous_deployment.updated_at + interval '1 microsecond')
  where id = previous_deployment.id
  returning * into updated_deployment;

  status_label := initcap(previous_deployment.proposed_status);
  if approve then
    insert into public.deployment_history (deployment_id, actor_user_id, event_type, metadata)
    values (updated_deployment.id, caller_id, 'status_changed', jsonb_build_object('before', jsonb_build_object('status', previous_deployment.status), 'after', jsonb_build_object('status', updated_deployment.status)));
  end if;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'deployments', updated_deployment.id::text, case when approve then 'status_approved' else 'status_rejected' end,
    jsonb_build_object('employee_id', updated_deployment.employee_id, 'proposed_status', previous_deployment.proposed_status));
  perform private.notify_deployment_employee(
    updated_deployment,
    case when approve then 'Deployment status approved' else 'Deployment status rejected' end,
    case when approve
      then format('HR approved your %s update for the deployment to %s.', status_label, coalesce(updated_deployment.location, 'your assignment'))
      else format('HR rejected your %s update for the deployment to %s. Check your proof and try again.', status_label, coalesce(updated_deployment.location, 'your assignment'))
    end
  );
end;
$$;

-- 9. Grants -----------------------------------------------------------------------

revoke all on function private.notify_deployment_employee(public.deployments, text, text) from public, anon, authenticated;

revoke all on function public.update_deployment_details(uuid, timestamptz, text, date, date, text, text, text) from public, anon;
revoke all on function public.cancel_deployment(uuid, timestamptz) from public, anon;
revoke all on function public.propose_deployment_status(uuid, text) from public, anon;
revoke all on function public.review_deployment_status(uuid, boolean) from public, anon;
grant execute on function public.update_deployment_details(uuid, timestamptz, text, date, date, text, text, text) to authenticated;
grant execute on function public.cancel_deployment(uuid, timestamptz) to authenticated;
grant execute on function public.propose_deployment_status(uuid, text) to authenticated;
grant execute on function public.review_deployment_status(uuid, boolean) to authenticated;

-- The legacy single-employee RPCs let HR write any status; HR now uses the RPCs above.
revoke all on function public.create_deployment(uuid, text, text, text, text, date, date, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_deployment(uuid, timestamptz, text, text, text, text, date, date, text, text, text, text) from public, anon, authenticated;
