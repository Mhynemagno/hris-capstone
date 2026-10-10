-- Client round 5 (2026-10-10): Maternity Leave is offered to female employees and Paternity Leave to
-- male employees. Enforced for every insert path with a trigger, so submit_leave_request stays unchanged.

alter table public.leave_types
  add column eligible_gender text check (eligible_gender is null or eligible_gender in ('female', 'male'));

update public.leave_types set eligible_gender = 'female' where lower(name) = 'maternity leave';
update public.leave_types set eligible_gender = 'male' where lower(name) = 'paternity leave';

create function private.enforce_leave_type_gender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  type_name text;
  required_gender text;
  employee_gender text;
begin
  select name, eligible_gender into type_name, required_gender from public.leave_types where id = new.leave_type_id;
  if required_gender is null then
    return new;
  end if;
  select gender into employee_gender from public.employees where id = new.employee_id;
  if employee_gender is distinct from required_gender then
    raise exception '% is only available to % employees.', type_name, required_gender using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_leave_type_gender() from public, anon, authenticated;

create trigger leave_requests_enforce_gender
  before insert on public.leave_requests
  for each row execute function private.enforce_leave_type_gender();
