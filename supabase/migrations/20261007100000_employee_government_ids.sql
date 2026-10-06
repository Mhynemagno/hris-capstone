-- Government ID numbers on the personnel record (adviser request, 2026-10-07):
--   * employees.sss_number (10 digits) and employees.philhealth_number (12 digits), both optional and
--     stored as digits only; the app shows them with the usual dashes (12-3456789-0, 12-345678901-2).
--   * Employees save their own numbers directly through public.update_my_government_ids (no HR approval
--     step); dashes and spaces are stripped, and a blank value clears the number.
--   * HR edits them on the personnel record through the existing column-level UPDATE grant and the
--     employees_update_hr row policy.

alter table public.employees
  add column sss_number text check (sss_number is null or sss_number ~ '^[0-9]{10}$'),
  add column philhealth_number text check (philhealth_number is null or philhealth_number ~ '^[0-9]{12}$');

grant update (sss_number, philhealth_number) on public.employees to authenticated;

create or replace function public.update_my_government_ids(target_sss_number text, target_philhealth_number text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  own_employee uuid := private.require_active_employee_self();
  clean_sss text := nullif(regexp_replace(coalesce(target_sss_number, ''), '[\s-]', '', 'g'), '');
  clean_philhealth text := nullif(regexp_replace(coalesce(target_philhealth_number, ''), '[\s-]', '', 'g'), '');
begin
  if clean_sss is not null and clean_sss !~ '^[0-9]{10}$' then
    raise exception 'Enter a 10-digit SSS number.' using errcode = '22023';
  end if;
  if clean_philhealth is not null and clean_philhealth !~ '^[0-9]{12}$' then
    raise exception 'Enter a 12-digit PhilHealth number.' using errcode = '22023';
  end if;

  update public.employees
  set sss_number = clean_sss, philhealth_number = clean_philhealth
  where id = own_employee;

  -- The numbers themselves stay out of the audit log.
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'employees', own_employee::text, 'government_ids_updated', jsonb_build_object('sss_number_set', clean_sss is not null, 'philhealth_number_set', clean_philhealth is not null));
end;
$$;

revoke all on function public.update_my_government_ids(text, text) from public, anon;
grant execute on function public.update_my_government_ids(text, text) to authenticated, service_role;
