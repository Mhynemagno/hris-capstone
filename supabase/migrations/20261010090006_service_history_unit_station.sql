-- Client round 5 (2026-10-10): each service history entry records where the officer was assigned
-- (Unit / Station, chosen from the catalogue and stored by name like employees.unit_station).
alter table public.service_history
  add column unit_station text check (unit_station is null or (unit_station = btrim(unit_station) and char_length(unit_station) between 1 and 160));
