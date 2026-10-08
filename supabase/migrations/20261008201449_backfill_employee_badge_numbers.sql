-- Badge numbers are the employee login identifiers. Keep the values in the
-- six-digit station format used by the personnel form and badge-number login.
-- The two named accounts are intentionally reassigned first; all other rows
-- are changed only when the value is missing or blank.
do $$
declare
  target_email text;
  target_profile_id uuid;
  target_employee_id uuid;
  candidate_employee_id uuid;
  candidate_number integer := 1;
  candidate_badge text;
begin
  lock table public.employees in share row exclusive mode;

  foreach target_email in array array[
    'jhestineitsolution@gmail.com',
    'nehynemagno@gmail.com'
  ]
  loop
    select profile.id
      into target_profile_id
      from public.profiles profile
     where lower(profile.email) = target_email;

    if target_profile_id is null then
      raise notice 'Skipped badge assignment: no profile exists for %.', target_email;
      continue;
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
           and employee.id <> target_employee_id
      );
      candidate_number := candidate_number + 1;
      if candidate_number > 999999 then
        raise exception 'No unassigned badge numbers remain.' using errcode = '22023';
      end if;
    end loop;

    update public.employees
       set employee_number = candidate_badge
     where id = target_employee_id;
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
