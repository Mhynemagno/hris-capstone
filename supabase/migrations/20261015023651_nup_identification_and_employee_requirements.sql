alter table public.employees
  add column emergency_contact_relationship text;

alter table public.employees
  add constraint employees_emergency_contact_relationship_check
  check (emergency_contact_relationship is null or emergency_contact_relationship in ('spouse', 'parent', 'child', 'sibling', 'other'));

alter table public.employees
  add constraint employees_active_unit_station_required_check
  check (employment_status = 'retired' or nullif(btrim(unit_station), '') is not null) not valid;

-- End of migration.

