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

revoke all on function public.update_my_employee_profile_image_path(text) from public, anon;
grant execute on function public.update_my_employee_profile_image_path(text) to authenticated;
