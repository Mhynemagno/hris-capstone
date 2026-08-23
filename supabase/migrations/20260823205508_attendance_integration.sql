create table public.attendance_integration_settings (
  id uuid primary key default gen_random_uuid(),
  adapter_key text not null unique default 'csv_xlsx' check (adapter_key = 'csv_xlsx'),
  timezone text not null default 'Asia/Ulaanbaatar' check (timezone = 'Asia/Ulaanbaatar'),
  workday_start time not null default time '08:00',
  late_grace_minutes integer not null default 15 check (late_grace_minutes between 0 and 120),
  template_version text not null default 'v1' check (template_version = btrim(template_version) and char_length(template_version) between 1 and 40),
  is_enabled boolean not null default true,
  updated_by_user_id uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.attendance_integration_settings (adapter_key) values ('csv_xlsx');

create table public.attendance_identity_mappings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  external_employee_id text not null unique check (external_employee_id = upper(btrim(external_employee_id)) and char_length(external_employee_id) between 1 and 64),
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_imports (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null check (source_filename = btrim(source_filename) and char_length(source_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  adapter_key text not null default 'csv_xlsx' check (adapter_key = 'csv_xlsx'),
  status text not null default 'processing' check (status in ('processing', 'completed', 'completed_with_issues', 'failed')),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  unmatched_count integer not null default 0 check (unmatched_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  error_summary text check (error_summary is null or (error_summary = btrim(error_summary) and char_length(error_summary) <= 2000)),
  imported_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  integration_id uuid not null references public.attendance_integration_settings(id) on delete restrict,
  source_event_id text not null check (source_event_id = btrim(source_event_id) and char_length(source_event_id) between 1 and 128),
  external_employee_id text not null check (external_employee_id = upper(btrim(external_employee_id)) and char_length(external_employee_id) between 1 and 64),
  attendance_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  status text not null check (status in ('present', 'late', 'absent', 'incomplete')),
  import_id uuid not null references public.attendance_imports(id) on delete restrict,
  sync_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(sync_metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (integration_id, source_event_id),
  check (time_out is null or time_in is null or time_out >= time_in),
  check ((status = 'absent' and time_in is null and time_out is null) or (status <> 'absent' and time_in is not null))
);

create table public.attendance_unmatched_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.attendance_integration_settings(id) on delete restrict,
  source_event_id text not null check (source_event_id = btrim(source_event_id) and char_length(source_event_id) between 1 and 128),
  external_employee_id text not null check (external_employee_id = upper(btrim(external_employee_id)) and char_length(external_employee_id) between 1 and 64),
  attendance_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  event_type text not null check (event_type in ('attendance', 'absence')),
  import_id uuid not null references public.attendance_imports(id) on delete restrict,
  sync_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(sync_metadata) = 'object'),
  resolved_by_user_id uuid references public.profiles(id),
  resolved_at timestamptz,
  resolved_log_id uuid references public.attendance_logs(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (integration_id, source_event_id),
  check (time_out is null or time_in is null or time_out >= time_in),
  check ((event_type = 'absence' and time_in is null and time_out is null) or (event_type = 'attendance' and time_in is not null))
);

create index attendance_logs_employee_date_idx on public.attendance_logs (employee_id, attendance_date desc, time_in desc);
create index attendance_logs_status_date_idx on public.attendance_logs (status, attendance_date desc);
create index attendance_logs_import_idx on public.attendance_logs (import_id);
create index attendance_unmatched_open_idx on public.attendance_unmatched_events (created_at desc) where resolved_at is null;
create index attendance_imports_created_idx on public.attendance_imports (created_at desc);

alter table public.attendance_integration_settings enable row level security;
alter table public.attendance_identity_mappings enable row level security;
alter table public.attendance_imports enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.attendance_unmatched_events enable row level security;

revoke all on public.attendance_integration_settings, public.attendance_identity_mappings, public.attendance_imports, public.attendance_logs, public.attendance_unmatched_events from anon, authenticated;
grant select on public.attendance_integration_settings, public.attendance_identity_mappings, public.attendance_imports, public.attendance_logs, public.attendance_unmatched_events to authenticated;

create policy attendance_settings_select_admin on public.attendance_integration_settings for select to authenticated using ((select private.current_user_has_role('system_administrator'::public.app_role)));
create policy attendance_mappings_select_hr on public.attendance_identity_mappings for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy attendance_imports_select_hr on public.attendance_imports for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy attendance_logs_select_hr on public.attendance_logs for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy attendance_logs_select_employee on public.attendance_logs for select to authenticated using (exists (select 1 from public.employees where employees.id = attendance_logs.employee_id and employees.profile_id = (select auth.uid())));
create policy attendance_unmatched_select_hr on public.attendance_unmatched_events for select to authenticated using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create or replace function private.require_attendance_admin()
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not (select private.current_user_has_role('system_administrator'::public.app_role)) then
    raise exception 'System administrator access is required.' using errcode = '42501';
  end if;
  return caller_id;
end;
$$;

create or replace function private.create_attendance_import(target_filename text, target_mime_type text, target_checksum text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); result_id uuid;
begin
  if nullif(btrim(target_filename), '') is null or char_length(btrim(target_filename)) > 255 or target_mime_type not in ('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or target_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'Attendance import metadata is invalid.' using errcode = '22023';
  end if;
  insert into public.attendance_imports (source_filename, mime_type, checksum_sha256, imported_by_user_id)
  values (btrim(target_filename), target_mime_type, target_checksum, caller_id) returning id into result_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'attendance_imports', result_id::text, 'created', '{}'::jsonb);
  return result_id;
end;
$$;

create or replace function private.process_attendance_event(target_import_id uuid, target_external_employee_id text, target_source_event_id text, target_attendance_date date, target_time_in timestamptz, target_time_out timestamptz, target_event_type text, target_metadata jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); setting_row public.attendance_integration_settings%rowtype; mapping_row public.attendance_identity_mappings%rowtype; result_status text; clean_external text := upper(btrim(target_external_employee_id)); clean_event text := btrim(target_source_event_id);
begin
  select * into setting_row from public.attendance_integration_settings where adapter_key = 'csv_xlsx' for share;
  if not found or not setting_row.is_enabled then raise exception 'Attendance import is unavailable.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.attendance_imports where id = target_import_id) then raise exception 'Attendance import was not found.' using errcode = 'P0001'; end if;
  if clean_external is null or char_length(clean_external) not between 1 and 64 or clean_event is null or char_length(clean_event) not between 1 and 128 or target_event_type not in ('attendance', 'absence') or jsonb_typeof(target_metadata) <> 'object' or exists (select 1 from jsonb_object_keys(target_metadata) key where key not in ('adapterVersion', 'templateVersion', 'rowNumber', 'checksum')) then raise exception 'Attendance event is invalid.' using errcode = '22023'; end if;
  if (target_event_type = 'absence' and (target_time_in is not null or target_time_out is not null)) or (target_event_type = 'attendance' and target_time_in is null) or (target_time_out is not null and target_time_out < target_time_in) then raise exception 'Attendance event times are invalid.' using errcode = '22007'; end if;
  if exists (select 1 from public.attendance_logs where integration_id = setting_row.id and source_event_id = clean_event) or exists (select 1 from public.attendance_unmatched_events where integration_id = setting_row.id and source_event_id = clean_event) then return 'duplicate'; end if;
  select * into mapping_row from public.attendance_identity_mappings where external_employee_id = clean_external for share;
  if not found then
    insert into public.attendance_unmatched_events (integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, event_type, import_id, sync_metadata)
    values (setting_row.id, clean_event, clean_external, target_attendance_date, target_time_in, target_time_out, target_event_type, target_import_id, target_metadata);
    update public.attendance_imports set unmatched_count = unmatched_count + 1 where id = target_import_id;
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_unmatched_events', clean_event, 'queued', jsonb_build_object('external_employee_id', clean_external));
    return 'unmatched';
  end if;
  result_status := case when target_event_type = 'absence' then 'absent' when target_time_out is null then 'incomplete' when (target_time_in at time zone setting_row.timezone)::time > setting_row.workday_start + make_interval(mins => setting_row.late_grace_minutes) then 'late' else 'present' end;
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, sync_metadata)
  values (mapping_row.employee_id, setting_row.id, clean_event, clean_external, target_attendance_date, target_time_in, target_time_out, result_status, target_import_id, target_metadata);
  update public.attendance_imports set accepted_count = accepted_count + 1 where id = target_import_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_logs', clean_event, 'imported', jsonb_build_object('employee_id', mapping_row.employee_id, 'status', result_status));
  return 'inserted';
end;
$$;

create or replace function private.resolve_attendance_unmatched_event(target_unmatched_event_id uuid, target_employee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); event_row public.attendance_unmatched_events%rowtype; setting_row public.attendance_integration_settings%rowtype; mapped_employee uuid; existing_external text; result_log_id uuid; result_status text;
begin
  select * into event_row from public.attendance_unmatched_events where id = target_unmatched_event_id for update;
  if not found or event_row.resolved_at is not null then raise exception 'Unmatched attendance event was not found.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.employees where id = target_employee_id) then raise exception 'Employee was not found.' using errcode = 'P0001'; end if;
  select employee_id into mapped_employee from public.attendance_identity_mappings where external_employee_id = event_row.external_employee_id for update;
  if found and mapped_employee <> target_employee_id then raise exception 'External employee ID is already mapped.' using errcode = '23505'; end if;
  select external_employee_id into existing_external from public.attendance_identity_mappings where employee_id = target_employee_id for update;
  if found and existing_external <> event_row.external_employee_id then raise exception 'Employee already has a different external ID mapping.' using errcode = '23505'; end if;
  insert into public.attendance_identity_mappings (employee_id, external_employee_id, created_by_user_id) values (target_employee_id, event_row.external_employee_id, caller_id) on conflict (external_employee_id) do nothing;
  select * into setting_row from public.attendance_integration_settings where id = event_row.integration_id for share;
  result_status := case when event_row.event_type = 'absence' then 'absent' when event_row.time_out is null then 'incomplete' when (event_row.time_in at time zone setting_row.timezone)::time > setting_row.workday_start + make_interval(mins => setting_row.late_grace_minutes) then 'late' else 'present' end;
  insert into public.attendance_logs (employee_id, integration_id, source_event_id, external_employee_id, attendance_date, time_in, time_out, status, import_id, sync_metadata)
  values (target_employee_id, event_row.integration_id, event_row.source_event_id, event_row.external_employee_id, event_row.attendance_date, event_row.time_in, event_row.time_out, result_status, event_row.import_id, event_row.sync_metadata) returning id into result_log_id;
  update public.attendance_unmatched_events set resolved_by_user_id = caller_id, resolved_at = now(), resolved_log_id = result_log_id where id = event_row.id;
  update public.attendance_imports set accepted_count = accepted_count + 1 where id = event_row.import_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_unmatched_events', event_row.id::text, 'resolved', jsonb_build_object('employee_id', target_employee_id, 'log_id', result_log_id));
  return result_log_id;
end;
$$;

create or replace function private.update_attendance_integration_settings(target_template_version text, target_workday_start time, target_late_grace_minutes integer, target_timezone text, target_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_attendance_admin();
begin
  if target_timezone <> 'Asia/Ulaanbaatar' or target_late_grace_minutes not between 0 and 120 or nullif(btrim(target_template_version), '') is null or char_length(btrim(target_template_version)) > 40 then raise exception 'Attendance settings are invalid.' using errcode = '22023'; end if;
  update public.attendance_integration_settings set template_version = btrim(target_template_version), workday_start = target_workday_start, late_grace_minutes = target_late_grace_minutes, is_enabled = target_enabled, updated_by_user_id = caller_id, updated_at = now() where adapter_key = 'csv_xlsx';
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'attendance_integration_settings', 'csv_xlsx', 'updated', '{}'::jsonb);
end;
$$;

create or replace function public.create_attendance_import(target_filename text, target_mime_type text, target_checksum text) returns uuid language plpgsql security definer set search_path = '' as $$ begin return private.create_attendance_import(target_filename, target_mime_type, target_checksum); end; $$;
create or replace function public.process_attendance_event(target_import_id uuid, target_external_employee_id text, target_source_event_id text, target_attendance_date date, target_time_in timestamptz, target_time_out timestamptz, target_event_type text, target_metadata jsonb) returns text language plpgsql security definer set search_path = '' as $$ begin return private.process_attendance_event(target_import_id, target_external_employee_id, target_source_event_id, target_attendance_date, target_time_in, target_time_out, target_event_type, target_metadata); end; $$;
create or replace function public.resolve_attendance_unmatched_event(target_unmatched_event_id uuid, target_employee_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$ begin return private.resolve_attendance_unmatched_event(target_unmatched_event_id, target_employee_id); end; $$;
create or replace function public.update_attendance_integration_settings(target_template_version text, target_workday_start time, target_late_grace_minutes integer, target_timezone text, target_enabled boolean) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.update_attendance_integration_settings(target_template_version, target_workday_start, target_late_grace_minutes, target_timezone, target_enabled); end; $$;

revoke all on function private.require_attendance_admin(), private.create_attendance_import(text, text, text), private.process_attendance_event(uuid, text, text, date, timestamptz, timestamptz, text, jsonb), private.resolve_attendance_unmatched_event(uuid, uuid), private.update_attendance_integration_settings(text, time, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.create_attendance_import(text, text, text), public.process_attendance_event(uuid, text, text, date, timestamptz, timestamptz, text, jsonb), public.resolve_attendance_unmatched_event(uuid, uuid), public.update_attendance_integration_settings(text, time, integer, text, boolean) from public, anon;
grant execute on function public.create_attendance_import(text, text, text), public.process_attendance_event(uuid, text, text, date, timestamptz, timestamptz, text, jsonb), public.resolve_attendance_unmatched_event(uuid, uuid), public.update_attendance_integration_settings(text, time, integer, text, boolean) to authenticated;
