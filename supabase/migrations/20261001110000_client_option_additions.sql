-- Client feedback: more options for Unit / Section and Unit / Station.
insert into public.departments (name, is_active)
values ('Police Community Precinct / Sub-Stations', true)
on conflict (name) do update set is_active = true;

insert into public.unit_stations (name, is_active)
values ('San Juan Police Station', true)
on conflict (name) do update set is_active = true;
