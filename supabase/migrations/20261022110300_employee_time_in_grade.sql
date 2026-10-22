-- Time-In-Grade is shown on the HR record and the employee profile. The grade start date
-- follows the promotion readiness rule: the first service-history entry in the employee's
-- current rank (started on or before today), otherwise the Date Entered Service.

create or replace function private.employee_time_in_grade(target_employee_id uuid)
returns date language sql stable security definer set search_path = '' as $$
  select coalesce(
    (
      select min(history.started_on)
      from public.service_history history
      where history.employee_id = employee.id
        and history.rank_id = employee.rank_id
        and history.started_on <= current_date
    ),
    employee.employment_started_on
  )
  from public.employees employee
  where employee.id = target_employee_id and employee.rank_id is not null
$$;

-- Returns the date the employee's current rank took effect (null without a rank).
-- Callable by HR, system administrators, management, and the employee themself.
create or replace function public.get_employee_time_in_grade(target_employee_id uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  if not (
    exists (select 1 from public.employees employee where employee.id = target_employee_id and employee.profile_id = caller_id)
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
    or (select private.current_user_has_role('management'::public.app_role))
  ) then
    raise exception 'You cannot view this employee''s time in grade.' using errcode = '42501';
  end if;
  return private.employee_time_in_grade(target_employee_id);
end;
$$;

revoke all on function private.employee_time_in_grade(uuid) from public, anon, authenticated;
revoke all on function public.get_employee_time_in_grade(uuid) from public, anon;
grant execute on function public.get_employee_time_in_grade(uuid) to authenticated;
