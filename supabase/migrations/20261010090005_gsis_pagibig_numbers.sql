-- Client round 5 (2026-10-10): "IV. Government Identification" holds PhilHealth, GSIS and Pag-IBIG.
-- SSS is no longer shown or edited; sss_number and its data are kept untouched.
-- GSIS is the 11-digit BP number; Pag-IBIG is 12 digits (XXXX-XXXX-XXXX). Both are stored as digits only.

alter table public.employees
  add column gsis_number text check (gsis_number is null or gsis_number ~ '^[0-9]{11}$'),
  add column pagibig_number text check (pagibig_number is null or pagibig_number ~ '^[0-9]{12}$');

-- HR edits them on the personnel record (employee UPDATE is granted per column).
grant update (gsis_number, pagibig_number) on public.employees to authenticated;

drop function public.update_my_government_ids(text, text);

create function public.update_my_government_ids(target_philhealth_number text, target_gsis_number text, target_pagibig_number text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  own_employee uuid := private.require_active_employee_self();
  clean_philhealth text := nullif(regexp_replace(coalesce(target_philhealth_number, ''), '[\s-]', '', 'g'), '');
  clean_gsis text := nullif(regexp_replace(coalesce(target_gsis_number, ''), '[\s-]', '', 'g'), '');
  clean_pagibig text := nullif(regexp_replace(coalesce(target_pagibig_number, ''), '[\s-]', '', 'g'), '');
begin
  if clean_philhealth is not null and clean_philhealth !~ '^[0-9]{12}$' then
    raise exception 'Enter a 12-digit PhilHealth number.' using errcode = '22023';
  end if;
  if clean_gsis is not null and clean_gsis !~ '^[0-9]{11}$' then
    raise exception 'Enter an 11-digit GSIS number.' using errcode = '22023';
  end if;
  if clean_pagibig is not null and clean_pagibig !~ '^[0-9]{12}$' then
    raise exception 'Enter a 12-digit Pag-IBIG number.' using errcode = '22023';
  end if;

  update public.employees
  set philhealth_number = clean_philhealth, gsis_number = clean_gsis, pagibig_number = clean_pagibig
  where id = own_employee;

  -- The numbers themselves stay out of the audit log.
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'employees', own_employee::text, 'government_ids_updated', jsonb_build_object(
    'philhealth_number_set', clean_philhealth is not null,
    'gsis_number_set', clean_gsis is not null,
    'pagibig_number_set', clean_pagibig is not null
  ));
end;
$$;

revoke all on function public.update_my_government_ids(text, text, text) from public, anon;
grant execute on function public.update_my_government_ids(text, text, text) to authenticated, service_role;
