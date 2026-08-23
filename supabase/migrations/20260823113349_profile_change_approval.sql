create table public.profile_change_requests (
  id uuid primary key,
  employee_id uuid not null references public.employees (id) on delete restrict,
  submitted_by_user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text check (note is null or char_length(btrim(note)) <= 2000),
  decision_reason text check (decision_reason is null or char_length(btrim(decision_reason)) between 1 and 2000),
  decided_by_user_id uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('approved', 'rejected')) = (decided_at is not null and decided_by_user_id is not null)),
  check (status <> 'rejected' or decision_reason is not null)
);

create table public.profile_change_request_changes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.profile_change_requests (id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  kind text not null check (kind in ('contact', 'qualification')),
  field_key text,
  operation text check (operation in ('add', 'edit', 'remove')),
  qualification_id uuid references public.qualifications (id) on delete restrict,
  original_value jsonb not null,
  requested_value jsonb not null,
  created_at timestamptz not null default now(),
  unique (request_id, ordinal),
  check ((kind = 'contact' and field_key in ('personalEmail', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone') and operation is null and qualification_id is null) or (kind = 'qualification' and field_key is null and operation is not null))
);

create table public.profile_change_request_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.profile_change_requests (id) on delete cascade,
  object_path text not null unique check (object_path ~ '^profile-change-requests/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpe?g|webp)$'),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.profile_change_request_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.profile_change_requests (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('submitted', 'cancelled', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profile_change_requests_employee_created_idx on public.profile_change_requests (employee_id, created_at desc);
create index profile_change_requests_review_queue_idx on public.profile_change_requests (status, created_at asc);
create index profile_change_request_changes_request_idx on public.profile_change_request_changes (request_id, ordinal);
create index profile_change_request_history_request_idx on public.profile_change_request_history (request_id, created_at asc);

alter table public.profile_change_requests enable row level security;
alter table public.profile_change_request_changes enable row level security;
alter table public.profile_change_request_documents enable row level security;
alter table public.profile_change_request_history enable row level security;

revoke all on public.profile_change_requests, public.profile_change_request_changes, public.profile_change_request_documents, public.profile_change_request_history from anon, authenticated;
grant select on public.profile_change_requests, public.profile_change_request_changes, public.profile_change_request_documents, public.profile_change_request_history to authenticated;

create policy profile_change_requests_select_own_or_admin on public.profile_change_requests for select to authenticated using (
  submitted_by_user_id = (select auth.uid()) or (select private.current_user_has_role('system_administrator'::public.app_role))
);
create policy profile_change_request_changes_select_own_or_admin on public.profile_change_request_changes for select to authenticated using (
  exists (select 1 from public.profile_change_requests request where request.id = request_id and (request.submitted_by_user_id = (select auth.uid()) or (select private.current_user_has_role('system_administrator'::public.app_role))))
);
create policy profile_change_request_documents_select_own_or_admin on public.profile_change_request_documents for select to authenticated using (
  exists (select 1 from public.profile_change_requests request where request.id = request_id and (request.submitted_by_user_id = (select auth.uid()) or (select private.current_user_has_role('system_administrator'::public.app_role))))
);
create policy profile_change_request_history_select_own_or_admin on public.profile_change_request_history for select to authenticated using (
  exists (select 1 from public.profile_change_requests request where request.id = request_id and (request.submitted_by_user_id = (select auth.uid()) or (select private.current_user_has_role('system_administrator'::public.app_role))))
);

create policy private_documents_profile_change_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'profile-change-requests'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 3
);
create policy private_documents_profile_change_read_own on storage.objects for select to authenticated using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'profile-change-requests'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create or replace function private.profile_change_employee_for_user(caller_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select employee.id from public.employees employee where employee.profile_id = caller_id
$$;

create or replace function private.profile_change_qualification_value(source jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('name', source ->> 'name', 'institution', source ->> 'institution', 'qualificationLevel', nullif(source ->> 'qualificationLevel', ''), 'fieldOfStudy', nullif(source ->> 'fieldOfStudy', ''), 'awardedOn', source ->> 'awardedOn', 'notes', nullif(source ->> 'notes', ''))
$$;

create or replace function private.submit_profile_change_request(target_request_id uuid, request_note text, requested_changes jsonb, requested_documents jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); target_employee_id uuid; item jsonb; document jsonb; item_ordinal integer := 0; target_qualification_id uuid;
begin
  if caller_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  select private.profile_change_employee_for_user(caller_id) into target_employee_id;
  if target_employee_id is null then raise exception 'An employee record is required.' using errcode = '42501'; end if;
  if jsonb_typeof(requested_changes) <> 'array' or jsonb_array_length(requested_changes) < 1 or jsonb_array_length(requested_changes) > 20 then raise exception 'Provide between one and twenty changes.' using errcode = '22023'; end if;
  if jsonb_typeof(requested_documents) <> 'array' or jsonb_array_length(requested_documents) > 10 then raise exception 'Invalid supporting documents.' using errcode = '22023'; end if;
  insert into public.profile_change_requests (id, employee_id, submitted_by_user_id, note) values (target_request_id, target_employee_id, caller_id, nullif(btrim(request_note), ''));
  for item in select value from jsonb_array_elements(requested_changes) loop
    item_ordinal := item_ordinal + 1;
    if item ->> 'kind' = 'contact' then
      if item ->> 'field' not in ('personalEmail', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone') then raise exception 'Invalid contact field.' using errcode = '22023'; end if;
      insert into public.profile_change_request_changes (request_id, ordinal, kind, field_key, original_value, requested_value) values (target_request_id, item_ordinal, 'contact', item ->> 'field', coalesce(item -> 'originalValue', 'null'::jsonb), coalesce(item -> 'requestedValue', 'null'::jsonb));
    elsif item ->> 'kind' = 'qualification' then
      if item ->> 'operation' not in ('add', 'edit', 'remove') then raise exception 'Invalid qualification operation.' using errcode = '22023'; end if;
      target_qualification_id := nullif(item ->> 'qualificationId', '')::uuid;
      if item ->> 'operation' = 'add' and (target_qualification_id is not null or item -> 'originalValue' <> 'null'::jsonb) then raise exception 'Invalid qualification addition.' using errcode = '22023'; end if;
      if item ->> 'operation' in ('edit', 'remove') and (target_qualification_id is null or item -> 'originalValue' = 'null'::jsonb) then raise exception 'Invalid qualification target.' using errcode = '22023'; end if;
      if item ->> 'operation' <> 'remove' and (item -> 'requestedValue' is null or item -> 'requestedValue' = 'null'::jsonb or private.profile_change_qualification_value(item -> 'requestedValue') ->> 'name' is null or private.profile_change_qualification_value(item -> 'requestedValue') ->> 'institution' is null or private.profile_change_qualification_value(item -> 'requestedValue') ->> 'awardedOn' is null) then raise exception 'Invalid qualification details.' using errcode = '22023'; end if;
      insert into public.profile_change_request_changes (request_id, ordinal, kind, operation, qualification_id, original_value, requested_value) values (target_request_id, item_ordinal, 'qualification', item ->> 'operation', target_qualification_id, coalesce(item -> 'originalValue', 'null'::jsonb), coalesce(item -> 'requestedValue', 'null'::jsonb));
    else raise exception 'Invalid change kind.' using errcode = '22023'; end if;
  end loop;
  for document in select value from jsonb_array_elements(requested_documents) loop
    if document ->> 'objectPath' !~ ('^profile-change-requests/' || caller_id::text || '/' || target_request_id::text || '/[0-9a-f-]{36}\.(pdf|png|jpe?g|webp)$') or document ->> 'mimeType' not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') or coalesce((document ->> 'sizeBytes')::bigint, 0) not between 1 and 10485760 then raise exception 'Invalid supporting document.' using errcode = '22023'; end if;
    if not exists (select 1 from storage.objects object where object.bucket_id = 'private-documents' and object.name = document ->> 'objectPath' and object.owner_id = caller_id) then raise exception 'Supporting document was not uploaded by the requester.' using errcode = '42501'; end if;
    insert into public.profile_change_request_documents (request_id, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id) values (target_request_id, document ->> 'objectPath', btrim(document ->> 'fileName'), document ->> 'mimeType', (document ->> 'sizeBytes')::bigint, caller_id);
  end loop;
  insert into public.profile_change_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'submitted');
end;
$$;

create or replace function private.cancel_profile_change_request(target_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); request public.profile_change_requests%rowtype;
begin
  select * into request from public.profile_change_requests where id = target_request_id for update;
  if caller_id is null or request.submitted_by_user_id <> caller_id then raise exception 'Only the requesting employee can cancel this request.' using errcode = '42501'; end if;
  if request.status <> 'pending' then raise exception 'Only pending requests can be cancelled.' using errcode = 'P0001'; end if;
  update public.profile_change_requests set status = 'cancelled', updated_at = now() where id = target_request_id;
  insert into public.profile_change_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'cancelled');
end;
$$;

create or replace function private.decide_profile_change_request(target_request_id uuid, requested_decision text, requested_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); request public.profile_change_requests%rowtype; change_row public.profile_change_request_changes%rowtype; qualification public.qualifications%rowtype; current_value jsonb; next_value jsonb;
begin
  if caller_id is null or not exists (select 1 from public.user_roles role join public.profiles profile on profile.id = role.user_id where role.user_id = caller_id and role.role = 'system_administrator' and profile.is_active) then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if requested_decision not in ('approved', 'rejected') or (requested_decision = 'rejected' and nullif(btrim(requested_reason), '') is null) then raise exception 'Invalid decision.' using errcode = '22023'; end if;
  select * into request from public.profile_change_requests where id = target_request_id for update;
  if request.status <> 'pending' then raise exception 'Only pending requests can be decided.' using errcode = 'P0001'; end if;
  if requested_decision = 'approved' then
    for change_row in select * from public.profile_change_request_changes where request_id = target_request_id order by ordinal loop
      if change_row.kind = 'contact' then
        select coalesce(case change_row.field_key when 'personalEmail' then to_jsonb(employee.personal_email) when 'phone' then to_jsonb(employee.phone) when 'address' then to_jsonb(employee.address) when 'emergencyContactName' then to_jsonb(employee.emergency_contact_name) else to_jsonb(employee.emergency_contact_phone) end, 'null'::jsonb) into current_value from public.employees employee where employee.id = request.employee_id;
        if current_value is distinct from change_row.original_value then raise exception 'The official record changed while this request was pending.' using errcode = 'P0001'; end if;
        update public.employees set personal_email = case when change_row.field_key = 'personalEmail' then nullif(change_row.requested_value #>> '{}', '') else personal_email end, phone = case when change_row.field_key = 'phone' then nullif(change_row.requested_value #>> '{}', '') else phone end, address = case when change_row.field_key = 'address' then nullif(change_row.requested_value #>> '{}', '') else address end, emergency_contact_name = case when change_row.field_key = 'emergencyContactName' then nullif(change_row.requested_value #>> '{}', '') else emergency_contact_name end, emergency_contact_phone = case when change_row.field_key = 'emergencyContactPhone' then nullif(change_row.requested_value #>> '{}', '') else emergency_contact_phone end where id = request.employee_id;
      elsif change_row.operation = 'add' then
        next_value := private.profile_change_qualification_value(change_row.requested_value);
        insert into public.qualifications (employee_id, name, institution, qualification_level, field_of_study, awarded_on, notes) values (request.employee_id, next_value ->> 'name', next_value ->> 'institution', next_value ->> 'qualificationLevel', next_value ->> 'fieldOfStudy', (next_value ->> 'awardedOn')::date, next_value ->> 'notes');
      else
        select * into qualification from public.qualifications where id = change_row.qualification_id and employee_id = request.employee_id for update;
        if not found or jsonb_build_object('name', qualification.name, 'institution', qualification.institution, 'qualificationLevel', qualification.qualification_level, 'fieldOfStudy', qualification.field_of_study, 'awardedOn', qualification.awarded_on::text, 'notes', qualification.notes) is distinct from change_row.original_value then raise exception 'The qualification changed while this request was pending.' using errcode = 'P0001'; end if;
        if change_row.operation = 'remove' then delete from public.qualifications where id = qualification.id; else next_value := private.profile_change_qualification_value(change_row.requested_value); update public.qualifications set name = next_value ->> 'name', institution = next_value ->> 'institution', qualification_level = next_value ->> 'qualificationLevel', field_of_study = next_value ->> 'fieldOfStudy', awarded_on = (next_value ->> 'awardedOn')::date, notes = next_value ->> 'notes' where id = qualification.id; end if;
      end if;
    end loop;
  end if;
  update public.profile_change_requests set status = requested_decision, decision_reason = nullif(btrim(requested_reason), ''), decided_by_user_id = caller_id, decided_at = now(), updated_at = now() where id = target_request_id;
  insert into public.profile_change_request_history (request_id, actor_user_id, event_type, metadata) values (target_request_id, caller_id, requested_decision, jsonb_build_object('reason', nullif(btrim(requested_reason), '')));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'profile_change_requests', target_request_id::text, requested_decision, jsonb_build_object('employee_id', request.employee_id));
  insert into public.notifications (recipient_user_id, type, title, body, link) values (request.submitted_by_user_id, 'profile_change_decision', 'Profile change request ' || requested_decision, case when requested_decision = 'approved' then 'Your profile change request was approved.' else 'Your profile change request was rejected.' end, '/employee/profile/change-requests');
end;
$$;

create or replace function public.submit_profile_change_request(target_request_id uuid, request_note text, requested_changes jsonb, requested_documents jsonb) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.submit_profile_change_request(target_request_id, request_note, requested_changes, requested_documents); end; $$;
create or replace function public.cancel_profile_change_request(target_request_id uuid) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.cancel_profile_change_request(target_request_id); end; $$;
create or replace function public.decide_profile_change_request(target_request_id uuid, requested_decision text, requested_reason text) returns void language plpgsql security definer set search_path = '' as $$ begin perform private.decide_profile_change_request(target_request_id, requested_decision, requested_reason); end; $$;

revoke all on function private.profile_change_employee_for_user(uuid), private.profile_change_qualification_value(jsonb), private.submit_profile_change_request(uuid, text, jsonb, jsonb), private.cancel_profile_change_request(uuid), private.decide_profile_change_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.submit_profile_change_request(uuid, text, jsonb, jsonb), public.cancel_profile_change_request(uuid), public.decide_profile_change_request(uuid, text, text) from public, anon;
grant execute on function public.submit_profile_change_request(uuid, text, jsonb, jsonb), public.cancel_profile_change_request(uuid), public.decide_profile_change_request(uuid, text, text) to authenticated;
