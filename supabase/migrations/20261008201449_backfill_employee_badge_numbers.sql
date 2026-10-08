-- Badge numbers are employee login identifiers. The two named HR/admin
-- accounts are personnel too, so create their linked records when absent,
-- then assign collision-free badge numbers before the remaining backfill.
do $$
declare
  target_email text;
  target_profile_id uuid;
  target_employee_id uuid;
  target_started_on date;
  default_rank_id bigint;
  default_department_id bigint;
  candidate_employee_id uuid;
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

  foreach target_email in array array[
    'jhestineitsolution@gmail.com',
    'nehynemagno@gmail.com'
  ]
  loop
    select profile.id, profile.created_at::date
      into target_profile_id, target_started_on
      from public.profiles profile
     where lower(profile.email) = target_email
     for update;

    if target_profile_id is null then
      raise exception 'Cannot assign a badge number: no profile exists for %.', target_email
        using errcode = 'P0002';
    end if;

    select employee.id
      into target_employee_id
      from public.employees employee
     where employee.profile_id = target_profile_id
     for update;

    if target_employee_id is null then
      raise exception 'Cannot assign a badge number: no employee record is linked to %.', target_email
        using errcode = 'P0002';
    end if;

    loop
      candidate_badge := format('%s-%s', candidate_number / 100000, lpad((candidate_number % 100000)::text, 5, '0'));
      exit when not exists (
        select 1
          from public.employees employee
         where employee.employee_number = candidate_badge
           and (target_employee_id is null or employee.id <> target_employee_id)
      );
      candidate_number := candidate_number + 1;
      if candidate_number > 999999 then
        raise exception 'No unassigned badge numbers remain.' using errcode = '22023';
      end if;
    end loop;

    if target_employee_id is null then
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
        target_profile_id,
        candidate_badge,
        case target_email when 'jhestineitsolution@gmail.com' then 'JhesTine' else 'Nehyne' end,
        case target_email when 'jhestineitsolution@gmail.com' then 'Solution' else 'Magno' end,
        target_email,
        default_department_id,
        default_rank_id,
        target_started_on
      )
      returning id into target_employee_id;
    else
      update public.employees
         set employee_number = candidate_badge
       where id = target_employee_id;
    end if;
    candidate_number := candidate_number + 1;
  end loop;

  -- employee_number is normally NOT NULL, but this backfill also protects
  -- records imported before that constraint or repaired outside the app.
  for candidate_employee_id in
    select employee.id
      from public.employees employee
     where employee.employee_number is null
        or btrim(employee.employee_number) = ''
     order by employee.created_at, employee.id
     for update
  loop
    loop
      candidate_badge := format('%s-%s', candidate_number / 100000, lpad((candidate_number % 100000)::text, 5, '0'));
      exit when not exists (
        select 1
          from public.employees employee
         where employee.employee_number = candidate_badge
           and employee.id <> candidate_employee_id
      );
      candidate_number := candidate_number + 1;
      if candidate_number > 999999 then
        raise exception 'No unassigned badge numbers remain.' using errcode = '22023';
      end if;
    end loop;

    update public.employees
       set employee_number = candidate_badge
     where id = candidate_employee_id;
    candidate_number := candidate_number + 1;
  end loop;
end;
$$;
