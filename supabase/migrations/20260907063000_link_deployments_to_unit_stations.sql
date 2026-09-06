-- Retain the historic text label while recording the authoritative catalogue row.
insert into public.unit_stations (name)
select distinct unit from public.deployments where unit is not null and btrim(unit) <> ''
on conflict (name) do nothing;

alter table public.deployments
  add column unit_station_id bigint references public.unit_stations(id) on delete restrict;

update public.deployments deployment
set unit_station_id = unit_station.id
from public.unit_stations unit_station
where deployment.unit = unit_station.name;

create or replace function private.sync_deployment_unit_station()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare selected_unit_station_id bigint;
begin
  if new.unit is null then
    new.unit_station_id := null;
    return new;
  end if;

  select unit_station.id into selected_unit_station_id
  from public.unit_stations unit_station
  where unit_station.name = new.unit and unit_station.is_active;

  if selected_unit_station_id is null then
    raise exception 'Select an active Unit/Station from the catalogue.' using errcode = '22023';
  end if;
  new.unit_station_id := selected_unit_station_id;
  return new;
end;
$$;

create trigger deployments_sync_unit_station
before insert or update of unit on public.deployments
for each row execute procedure private.sync_deployment_unit_station();

grant insert, update on public.unit_stations to authenticated;
create policy unit_stations_insert_hr on public.unit_stations for insert to authenticated
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy unit_stations_update_hr on public.unit_stations for update to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
