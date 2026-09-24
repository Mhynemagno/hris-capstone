-- The Unit/Station catalogue is organization master data, managed by the System Administrator
-- like departments and ranks. The app never wrote it before, so HR's unused write access is
-- replaced rather than widened.

drop policy unit_stations_insert_hr on public.unit_stations;
drop policy unit_stations_update_hr on public.unit_stations;

-- Everyone keeps reading the active catalogue; administrators also see deactivated stations.
create policy unit_stations_select_admin on public.unit_stations for select to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)));
create policy unit_stations_insert_admin on public.unit_stations for insert to authenticated
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));
create policy unit_stations_update_admin on public.unit_stations for update to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)))
  with check ((select private.current_user_has_role('system_administrator'::public.app_role)));

create trigger unit_stations_touch_updated_at
before update on public.unit_stations
for each row execute function private.touch_updated_at();

create trigger unit_stations_write_audit_log
after insert or update or delete on public.unit_stations
for each row execute function private.audit_privileged_change();

-- Personnel and deployment records store the station name as text, and the deployment trigger
-- matches that text against the catalogue. Renaming a station already in use would strand
-- those records, so a used name is kept; add the corrected station and deactivate this one.
create or replace function private.protect_used_unit_station_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name and (
    exists (select 1 from public.employees where unit_station = old.name)
    or exists (select 1 from public.deployments where unit_station_id = old.id or unit = old.name)
  ) then
    raise exception 'This unit/station is used on existing records and cannot be renamed. Add the corrected name and deactivate this one.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger unit_stations_protect_used_name
before update of name on public.unit_stations
for each row execute function private.protect_used_unit_station_name();

revoke all on function private.protect_used_unit_station_name() from public, anon, authenticated;
