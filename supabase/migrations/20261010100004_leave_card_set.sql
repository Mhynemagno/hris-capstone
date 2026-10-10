-- Client round 5 (2026-10-10): the leave types shown as cards, with their yearly days and notes:
--   Mandatory Leave 2 days ("2 days per year standard entitlement"), Sick Leave 15 ("Requires a medical
--   certificate"), Vacation Leave 15 ("Subject to prior approval & unit clearance"), Special Privilege Leave 3
--   ("Non-cumulative / Non-commutative"). Maternity and Paternity Leave stay as they are.
-- HR also sees an employee's remaining credits (get_employee_leave_balances).

update public.leave_types set days_per_year = 2, description = '2 days per year standard entitlement.', is_active = true, updated_at = now() where lower(name) = 'mandatory leave';
update public.leave_types set days_per_year = 15, description = 'Requires a medical certificate.', is_active = true, updated_at = now() where lower(name) = 'sick leave';
update public.leave_types set days_per_year = 15, description = 'Subject to prior approval & unit clearance.', is_active = true, updated_at = now() where lower(name) = 'vacation leave';

insert into public.leave_types (name, description, requires_attachment, is_active, days_per_year)
select 'Special Privilege Leave', 'Non-cumulative / Non-commutative.', false, true, 3
where not exists (select 1 from public.leave_types where lower(name) = 'special privilege leave');
update public.leave_types set days_per_year = 3, description = 'Non-cumulative / Non-commutative.', is_active = true, updated_at = now() where lower(name) = 'special privilege leave';

create function private.get_employee_leave_balances(target_employee_id uuid, target_year integer)
returns table (leave_type_id uuid, days_per_year integer, excess_deducted_from_retirement boolean, used_days integer)
language plpgsql stable security definer set search_path = '' as $$
declare employee_gender text;
begin
  perform private.require_active_hr();
  select gender into employee_gender from public.employees where id = target_employee_id;
  return query
    select type.id, type.days_per_year, type.excess_deducted_from_retirement, private.leave_days_used(target_employee_id, type.id, target_year)
    from public.leave_types type
    where type.is_active and (type.eligible_gender is null or type.eligible_gender = employee_gender);
end;
$$;

create function public.get_employee_leave_balances(target_employee_id uuid, target_year integer)
returns table (leave_type_id uuid, days_per_year integer, excess_deducted_from_retirement boolean, used_days integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query select * from private.get_employee_leave_balances(target_employee_id, target_year);
end;
$$;

revoke all on function private.get_employee_leave_balances(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_employee_leave_balances(uuid, integer) from public, anon;
grant execute on function public.get_employee_leave_balances(uuid, integer) to authenticated;
