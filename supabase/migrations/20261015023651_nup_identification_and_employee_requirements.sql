alter table public.employees
  add column emergency_contact_relationship text not null default 'other';

alter table public.employees
  add constraint employees_emergency_contact_relationship_check
  check (emergency_contact_relationship in ('spouse', 'parent', 'child', 'sibling', 'other'));

-- Employee writes use column-level privileges.  Include the new field so HR can
-- persist the required relationship chosen in the personnel form.
grant update (emergency_contact_relationship) on public.employees to authenticated;

alter table public.employees
  alter column unit_station set default 'San Juan Police Station';

update public.employees
set unit_station = 'San Juan Police Station'
where employment_status <> 'retired'
  and nullif(btrim(unit_station), '') is null;

alter table public.employees
  add constraint employees_active_unit_station_required_check
  check (employment_status = 'retired' or nullif(btrim(unit_station), '') is not null);

create function private.enforce_employee_number_for_rank()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_rank_code text;
begin
  select rank.code
  into target_rank_code
  from public.ranks as rank
  where rank.id = new.rank_id;

  if target_rank_code = 'NUP' and new.employee_number !~ '^[0-9]{8}$' then
    raise exception 'Non-uniformed personnel ID number must contain 8 digits.'
      using errcode = '23514', constraint = 'employees_nup_employee_number_check';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_employee_number_for_rank() from public, anon, authenticated;

create trigger employees_enforce_nup_employee_number
  before insert or update of rank_id, employee_number on public.employees
  for each row execute function private.enforce_employee_number_for_rank();

create function private.enforce_nup_rank_code_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code = 'NUP'
    and old.code is distinct from new.code
    and exists (
      select 1
      from public.employees as employee
      where employee.rank_id = new.id
        and employee.employee_number !~ '^[0-9]{8}$'
    ) then
    raise exception 'Non-uniformed personnel ID number must contain 8 digits.'
      using errcode = '23514', constraint = 'employees_nup_employee_number_check';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_nup_rank_code_change() from public, anon, authenticated;

create trigger ranks_enforce_nup_employee_number
  before update of code on public.ranks
  for each row execute function private.enforce_nup_rank_code_change();

