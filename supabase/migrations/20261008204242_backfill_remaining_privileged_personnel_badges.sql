-- HR, management, and administrator accounts are personnel. Backfill any
-- remaining privileged account that has not yet been linked to a record.
do $$
declare
  account record;
  default_rank_id bigint;
  default_department_id bigint;
  candidate_number integer := 1;
  candidate_badge text;
begin
  lock table public.employees in share row exclusive mode;

  select rank_row.id
    into default_rank_id
    from public.ranks rank_row
   where rank_row.is_active = true
   order by rank_row.sort_order, rank_row.id
   limit 1;

  select department.id
    into default_department_id
    from public.departments department
   where department.is_active = true
   order by department.name, department.id
   limit 1;

  if default_rank_id is null or default_department_id is null then
    raise exception 'Cannot create personnel records without an active rank and department.' using errcode = 'P0002';
  end if;

  for account in
    select profile.id,
           profile.email,
           profile.created_at::date as started_on,
           coalesce(nullif(btrim(user_account.raw_user_meta_data ->> 'first_name'), ''), split_part(coalesce(profile.full_name, split_part(profile.email, '@', 1)), ' ', 1)) as first_name,
           coalesce(nullif(btrim(user_account.raw_user_meta_data ->> 'last_name'), ''), split_part(profile.email, '@', 1)) as last_name
      from public.profiles profile
      join auth.users user_account on user_account.id = profile.id
     where exists (
       select 1
         from public.user_roles role
        where role.user_id = profile.id
          and role.role in ('employee', 'hr_personnel', 'management', 'system_administrator')
     )
       and not exists (
         select 1
           from public.employees employee
          where employee.profile_id = profile.id
       )
     order by profile.created_at, profile.id
     for update of profile
  loop
    loop
      candidate_badge := format('%s-%s', candidate_number / 100000, lpad((candidate_number % 100000)::text, 5, '0'));
      exit when not exists (
        select 1
          from public.employees employee
         where employee.employee_number = candidate_badge
      );
      candidate_number := candidate_number + 1;
      if candidate_number > 999999 then
        raise exception 'No unassigned badge numbers remain.' using errcode = '22023';
      end if;
    end loop;

    insert into public.employees (
      profile_id,
      employee_number,
      first_name,
      last_name,
      personal_email,
      department_id,
      rank_id,
      employment_started_on
    )
    values (
      account.id,
      candidate_badge,
      account.first_name,
      account.last_name,
      account.email,
      default_department_id,
      default_rank_id,
      account.started_on
    );

    candidate_number := candidate_number + 1;
  end loop;
end;
$$;
