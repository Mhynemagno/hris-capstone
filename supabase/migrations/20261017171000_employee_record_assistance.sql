-- An employee whose portal account has not yet been linked can alert active HR staff
-- without exposing directory data or granting the employee personnel-write access.

create or replace function public.request_employee_record_assistance()
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not (select private.current_user_has_role('employee'::public.app_role)) then
    raise exception 'Employee access is required.' using errcode = '42501';
  end if;
  if exists (select 1 from public.employees where profile_id = caller_id) then
    raise exception 'Your employee record is already linked.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.audit_logs
    where actor_user_id = caller_id and entity_type = 'employee_record_assistance' and action = 'requested'
      and created_at >= now() - interval '24 hours'
  ) then
    return;
  end if;
  if not exists (
    select 1 from public.user_roles role join public.profiles profile on profile.id = role.user_id
    where role.role in ('hr_personnel'::public.app_role, 'system_administrator'::public.app_role) and profile.is_active
  ) then
    raise exception 'No active HR account is available.' using errcode = 'P0001';
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  select role.user_id, 'employee_record_assistance', 'Employee record link requested', 'An employee has asked HR to link their official personnel record to the portal account.', '/admin/personnel-records'
  from public.user_roles role join public.profiles profile on profile.id = role.user_id
  where role.role in ('hr_personnel'::public.app_role, 'system_administrator'::public.app_role) and profile.is_active;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action)
  values (caller_id, 'employee_record_assistance', caller_id::text, 'requested');
end;
$$;

revoke all on function public.request_employee_record_assistance() from public, anon;
grant execute on function public.request_employee_record_assistance() to authenticated;
