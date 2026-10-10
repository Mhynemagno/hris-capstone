-- Client round 5 (2026-10-10): an employee cannot be deployed twice on the same date.
-- A deployment occupies [starts_on, coalesce(ends_on, starts_on)]. Only scheduled and ongoing
-- deployments block each other. The check runs only when the employee, dates, or status change, so
-- editing the remarks of an older overlapping record still works.

create function private.prevent_overlapping_deployments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('scheduled', 'ongoing') then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and (new.employee_id, new.starts_on, new.ends_on, new.status) is not distinct from (old.employee_id, old.starts_on, old.ends_on, old.status) then
    return new;
  end if;

  -- Serialise checks per employee so two simultaneous saves cannot both pass.
  perform pg_advisory_xact_lock(hashtext('deployment:' || new.employee_id::text));

  if exists (
    select 1
    from public.deployments as other
    where other.employee_id = new.employee_id
      and other.id <> new.id
      and other.status in ('scheduled', 'ongoing')
      and daterange(other.starts_on, coalesce(other.ends_on, other.starts_on), '[]')
        && daterange(new.starts_on, coalesce(new.ends_on, new.starts_on), '[]')
  ) then
    raise exception 'This employee is already deployed on that date.' using errcode = '23P01';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_overlapping_deployments() from public, anon, authenticated;

-- Named to sort after deployments_preserve_historic_end_date and deployments_sync_unit_station: BEFORE
-- triggers fire alphabetically, so input validation and the final end date come first.
create trigger deployments_validate_no_overlap
  before insert or update on public.deployments
  for each row execute function private.prevent_overlapping_deployments();
