create or replace function private.list_unlinked_employee_accounts()
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  full_name text,
  email text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null
     or not exists (
       select 1
       from public.profiles profile
       join public.user_roles user_role on user_role.user_id = profile.id
       where profile.id = caller_id
         and profile.is_active
         and user_role.role = 'hr_personnel'::public.app_role
     ) then
    raise exception 'HR access is required.' using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    nullif(btrim(account.raw_user_meta_data ->> 'first_name'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'last_name'), ''),
    profile.full_name,
    profile.email
  from public.profiles profile
  join public.user_roles user_role on user_role.user_id = profile.id
  join auth.users account on account.id = profile.id
  left join public.employees employee on employee.profile_id = profile.id
  where profile.is_active
    and user_role.role = 'employee'::public.app_role
    and employee.id is null
  order by profile.full_name nulls last, profile.email nulls last, profile.id;
end;
$$;

create or replace function public.list_unlinked_employee_accounts()
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  full_name text,
  email text
)
language sql
security definer
stable
set search_path = ''
as $$
  select * from private.list_unlinked_employee_accounts();
$$;

revoke all on function private.list_unlinked_employee_accounts() from public, anon, authenticated;
revoke all on function public.list_unlinked_employee_accounts() from public, anon;
grant execute on function public.list_unlinked_employee_accounts() to authenticated;
