-- Client round 5 (2026-10-10): an email can belong to only one personnel record.
-- Existing duplicates are reported by name instead of failing on an opaque index error.

do $$
declare
  duplicates text;
begin
  select string_agg(email, ', ' order by email) into duplicates
  from (
    select lower(personal_email) as email
    from public.employees
    where personal_email is not null
    group by lower(personal_email)
    having count(*) > 1
  ) as repeated;

  if duplicates is not null then
    raise exception 'Fix duplicate employee personal emails before applying this migration: %', duplicates;
  end if;
end;
$$;

create unique index employees_personal_email_unique_idx
  on public.employees (lower(personal_email))
  where personal_email is not null;
