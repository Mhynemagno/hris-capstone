drop policy employee_profile_photos_insert_employee_or_hr on storage.objects;
drop policy employee_profile_photos_delete_employee_or_hr on storage.objects;

create policy employee_profile_photos_insert_linked_employee
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employee-profile-photos'
    and name ~ '^employees/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
    and (select private.current_user_has_role('employee'::public.app_role))
    and exists (
      select 1
      from public.employees employee
      where employee.profile_id = (select auth.uid())
        and name like 'employees/' || employee.id::text || '/%'
    )
  );

create policy employee_profile_photos_delete_linked_employee
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'employee-profile-photos'
    and (select private.current_user_has_role('employee'::public.app_role))
    and exists (
      select 1
      from public.employees employee
      where employee.profile_id = (select auth.uid())
        and name like 'employees/' || employee.id::text || '/%'
    )
  );

create or replace function public.update_my_employee_profile_image_path(target_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_employee_id uuid;
begin
  if not (select private.current_user_has_role('employee'::public.app_role)) then
    raise exception 'Only an employee can update a profile photo.' using errcode = '42501';
  end if;

  select employee.id
  into caller_employee_id
  from public.employees employee
  where employee.profile_id = caller_id;

  if caller_employee_id is null then
    raise exception 'Only a linked employee can update a profile photo.' using errcode = '42501';
  end if;

  if target_path is not null
    and target_path !~ (
      '^employees/' || caller_employee_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp)$'
    ) then
    raise exception 'Profile photo path must belong to the linked employee.' using errcode = '42501';
  end if;

  update public.employees
  set profile_image_path = target_path
  where id = caller_employee_id;
end;
$$;

revoke update on public.employees from authenticated;
grant update (
  profile_id,
  employee_number,
  first_name,
  middle_name,
  last_name,
  rank,
  unit_station,
  personal_email,
  phone,
  address,
  emergency_contact_name,
  emergency_contact_phone,
  department_id,
  position_id,
  employment_status,
  employment_started_on,
  employment_ended_on
) on public.employees to authenticated;
