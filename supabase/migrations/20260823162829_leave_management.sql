create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  description text check (description is null or (description = btrim(description) and char_length(description) <= 2000)),
  requires_attachment boolean not null default false,
  is_active boolean not null default true,
  created_by_user_id uuid not null references public.profiles(id),
  updated_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leave_requests (
  id uuid primary key,
  employee_id uuid not null references public.employees(id),
  submitted_by_user_id uuid not null references public.profiles(id),
  leave_type_id uuid not null references public.leave_types(id),
  leave_type_name text not null check (leave_type_name = btrim(leave_type_name) and char_length(leave_type_name) between 1 and 100),
  starts_on date not null check (starts_on >= current_date),
  ends_on date not null check (ends_on >= starts_on),
  reason text not null check (reason = btrim(reason) and char_length(reason) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text check (decision_note is null or (decision_note = btrim(decision_note) and char_length(decision_note) between 1 and 2000)),
  decided_by_user_id uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('pending', 'cancelled') and decided_by_user_id is null and decided_at is null and decision_note is null) or (status = 'approved' and decided_by_user_id is not null and decided_at is not null) or (status = 'rejected' and decided_by_user_id is not null and decided_at is not null and decision_note is not null))
);

create table public.leave_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.leave_requests(id) on delete restrict,
  object_path text not null unique check (object_path ~ '^leave-requests/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$'),
  file_name text not null check (file_name = btrim(file_name) and char_length(file_name) between 1 and 255 and file_name !~ '[\\/[:cntrl:]]'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.leave_request_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.leave_requests(id) on delete restrict,
  actor_user_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('submitted', 'cancelled', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create unique index leave_types_active_name_unique on public.leave_types (lower(name)) where is_active;
create index leave_requests_employee_created_idx on public.leave_requests (employee_id, created_at desc);
create index leave_requests_hr_queue_idx on public.leave_requests (status, starts_on, created_at asc);
create index leave_requests_type_idx on public.leave_requests (leave_type_id, starts_on);
create index leave_request_history_request_idx on public.leave_request_history (request_id, created_at asc);

alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_request_attachments enable row level security;
alter table public.leave_request_history enable row level security;

revoke all on public.leave_types, public.leave_requests, public.leave_request_attachments, public.leave_request_history from anon, authenticated;
grant select on public.leave_types, public.leave_requests, public.leave_request_attachments, public.leave_request_history to authenticated;

create policy leave_types_select_active_or_hr on public.leave_types for select to authenticated using (
  is_active or (select private.current_user_has_role('hr_personnel'::public.app_role))
);
create policy leave_requests_select_own_or_hr on public.leave_requests for select to authenticated using (
  submitted_by_user_id = (select auth.uid()) or (select private.current_user_has_role('hr_personnel'::public.app_role))
);
create policy leave_request_attachments_select_own_or_hr on public.leave_request_attachments for select to authenticated using (
  exists (select 1 from public.leave_requests request where request.id = request_id and (request.submitted_by_user_id = (select auth.uid()) or (select private.current_user_has_role('hr_personnel'::public.app_role))))
);
create policy leave_request_history_select_own_or_hr on public.leave_request_history for select to authenticated using (
  exists (select 1 from public.leave_requests request where request.id = request_id and (request.submitted_by_user_id = (select auth.uid()) or (select private.current_user_has_role('hr_personnel'::public.app_role))))
);

create policy leave_storage_insert_own on storage.objects for insert to authenticated with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'leave-requests'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 3
);
create policy leave_storage_read_own_or_hr on storage.objects for select to authenticated using (
  bucket_id = 'private-documents' and (
    ((storage.foldername(name))[1] = 'leave-requests' and (storage.foldername(name))[2] = (select auth.uid()::text))
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  )
);

create or replace function private.require_active_hr()
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (select 1 from public.user_roles role join public.profiles profile on profile.id = role.user_id where role.user_id = caller_id and role.role = 'hr_personnel'::public.app_role and profile.is_active) then
    raise exception 'HR access is required.' using errcode = '42501';
  end if;
  return caller_id;
end;
$$;

create or replace function private.create_leave_type(type_name text, type_description text, type_requires_attachment boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); new_type_id uuid;
begin
  insert into public.leave_types (name, description, requires_attachment, created_by_user_id, updated_by_user_id)
  values (btrim(type_name), nullif(btrim(type_description), ''), type_requires_attachment, caller_id, caller_id)
  returning id into new_type_id;
  return new_type_id;
end;
$$;

create or replace function private.update_leave_type(target_type_id uuid, type_name text, type_description text, type_requires_attachment boolean, type_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr();
begin
  update public.leave_types set name = btrim(type_name), description = nullif(btrim(type_description), ''), requires_attachment = type_requires_attachment, is_active = type_is_active, updated_by_user_id = caller_id, updated_at = now() where id = target_type_id;
  if not found then raise exception 'Leave type was not found.' using errcode = 'P0001'; end if;
end;
$$;

create or replace function private.submit_leave_request(target_request_id uuid, target_leave_type_id uuid, target_starts_on date, target_ends_on date, request_reason text, requested_attachments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); target_employee_id uuid; type_row public.leave_types%rowtype; attachment jsonb; attachment_path text;
begin
  if caller_id is null or not (select private.current_user_has_role('employee'::public.app_role)) then raise exception 'Employee access is required.' using errcode = '42501'; end if;
  select id into target_employee_id from public.employees where profile_id = caller_id;
  if target_employee_id is null then raise exception 'Employee record was not found.' using errcode = 'P0001'; end if;
  select * into type_row from public.leave_types where id = target_leave_type_id and is_active for share;
  if not found then raise exception 'Leave type is not active.' using errcode = 'P0001'; end if;
  if target_starts_on < current_date or target_ends_on < target_starts_on then raise exception 'Choose an inclusive current or future leave range.' using errcode = '22007'; end if;
  if request_reason is null or btrim(request_reason) = '' then raise exception 'A leave reason is required.' using errcode = '22023'; end if;
  if jsonb_typeof(requested_attachments) <> 'array' or jsonb_array_length(requested_attachments) > 10 or (type_row.requires_attachment and jsonb_array_length(requested_attachments) = 0) then raise exception 'Supporting evidence is required for this leave type.' using errcode = '22023'; end if;
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    attachment_path := attachment ->> 'objectPath';
    if attachment_path is null or attachment_path !~ ('^leave-requests/' || caller_id::text || '/' || target_request_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$') or attachment ->> 'fileName' !~ '^[^\\/[:cntrl:]]{1,255}$' or attachment ->> 'mimeType' not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') or coalesce((attachment ->> 'sizeBytes')::integer, 0) not between 1 and 10485760 or not exists (select 1 from storage.objects object where object.bucket_id = 'private-documents' and object.name = attachment_path and object.owner_id = caller_id) then
      raise exception 'Invalid leave attachment.' using errcode = '22023';
    end if;
  end loop;
  insert into public.leave_requests (id, employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on, reason)
  values (target_request_id, target_employee_id, caller_id, type_row.id, type_row.name, target_starts_on, target_ends_on, btrim(request_reason));
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    insert into public.leave_request_attachments (request_id, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (target_request_id, attachment ->> 'objectPath', btrim(attachment ->> 'fileName'), attachment ->> 'mimeType', (attachment ->> 'sizeBytes')::integer, caller_id);
  end loop;
  insert into public.leave_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'submitted');
end;
$$;

create or replace function private.cancel_leave_request(target_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); request_row public.leave_requests%rowtype;
begin
  select * into request_row from public.leave_requests where id = target_request_id for update;
  if not found or request_row.submitted_by_user_id <> caller_id or request_row.status <> 'pending' then raise exception 'Only the owning employee can cancel a pending leave request.' using errcode = '42501'; end if;
  update public.leave_requests set status = 'cancelled', updated_at = now() where id = target_request_id;
  insert into public.leave_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'cancelled');
end;
$$;

create or replace function private.decide_leave_request(target_request_id uuid, requested_decision text, requested_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); request_row public.leave_requests%rowtype; clean_note text := nullif(btrim(requested_note), '');
begin
  if requested_decision not in ('approved', 'rejected') or (requested_decision = 'rejected' and clean_note is null) then raise exception 'A reason is required when rejecting a leave request.' using errcode = '22023'; end if;
  select * into request_row from public.leave_requests where id = target_request_id for update;
  if not found or request_row.status <> 'pending' then raise exception 'Leave request is no longer pending.' using errcode = 'P0001'; end if;
  update public.leave_requests set status = requested_decision, decision_note = clean_note, decided_by_user_id = caller_id, decided_at = now(), updated_at = now() where id = target_request_id;
  insert into public.leave_request_history (request_id, actor_user_id, event_type, metadata) values (target_request_id, caller_id, requested_decision, jsonb_build_object('note', clean_note));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'leave_requests', target_request_id::text, requested_decision, jsonb_build_object('employee_id', request_row.employee_id));
  insert into public.notifications (recipient_user_id, type, title, body, link) values (request_row.submitted_by_user_id, 'leave_request_decision', 'Leave request ' || requested_decision, case when requested_decision = 'approved' then 'Your leave request was approved.' else 'Your leave request was rejected.' end, '/employee/leave');
end;
$$;

create or replace function public.create_leave_type(type_name text, type_description text, type_requires_attachment boolean) returns uuid language plpgsql security definer set search_path = '' as $$ begin return private.create_leave_type(type_name, type_description, type_requires_attachment); end; $$;
create or replace function public.update_leave_type(target_type_id uuid, type_name text, type_description text, type_requires_attachment boolean, type_is_active boolean) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.update_leave_type(target_type_id, type_name, type_description, type_requires_attachment, type_is_active); end; $$;
create or replace function public.submit_leave_request(target_request_id uuid, target_leave_type_id uuid, target_starts_on date, target_ends_on date, request_reason text, requested_attachments jsonb) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.submit_leave_request(target_request_id, target_leave_type_id, target_starts_on, target_ends_on, request_reason, requested_attachments); end; $$;
create or replace function public.cancel_leave_request(target_request_id uuid) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.cancel_leave_request(target_request_id); end; $$;
create or replace function public.decide_leave_request(target_request_id uuid, requested_decision text, requested_note text) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.decide_leave_request(target_request_id, requested_decision, requested_note); end; $$;

revoke all on function private.require_active_hr(), private.create_leave_type(text, text, boolean), private.update_leave_type(uuid, text, text, boolean, boolean), private.submit_leave_request(uuid, uuid, date, date, text, jsonb), private.cancel_leave_request(uuid), private.decide_leave_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_leave_type(text, text, boolean), public.update_leave_type(uuid, text, text, boolean, boolean), public.submit_leave_request(uuid, uuid, date, date, text, jsonb), public.cancel_leave_request(uuid), public.decide_leave_request(uuid, text, text) from public, anon;
grant execute on function public.create_leave_type(text, text, boolean), public.update_leave_type(uuid, text, text, boolean, boolean), public.submit_leave_request(uuid, uuid, date, date, text, jsonb), public.cancel_leave_request(uuid), public.decide_leave_request(uuid, text, text) to authenticated;
