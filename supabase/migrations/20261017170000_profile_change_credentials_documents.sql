-- Employees can propose eligibility, certification, and training changes, but only an
-- administrator applies them. Every request needs at least one private supporting file.

alter table public.profile_change_request_changes
  add column certification_id uuid references public.certifications (id) on delete restrict,
  add column training_record_id uuid references public.training_records (id) on delete restrict;

alter table public.profile_change_request_changes
  drop constraint if exists profile_change_request_changes_kind_check,
  drop constraint if exists profile_change_request_changes_check;

alter table public.profile_change_request_changes
  add constraint profile_change_request_changes_kind_check
    check (kind in ('contact', 'qualification', 'certification', 'training')),
  add constraint profile_change_request_changes_shape_check check (
    (kind = 'contact' and field_key in ('personalEmail', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone') and operation is null and qualification_id is null and certification_id is null and training_record_id is null)
    or (kind = 'qualification' and field_key is null and operation is not null and certification_id is null and training_record_id is null)
    or (kind = 'certification' and field_key is null and operation is not null and qualification_id is null and training_record_id is null)
    or (kind = 'training' and field_key is null and operation is not null and qualification_id is null and certification_id is null)
  );

create or replace function private.profile_change_certification_value(source jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('name', nullif(btrim(source ->> 'name'), ''), 'issuer', nullif(btrim(source ->> 'issuer'), ''), 'credentialId', nullif(btrim(source ->> 'credentialId'), ''), 'issuedOn', nullif(source ->> 'issuedOn', ''), 'expiresOn', nullif(source ->> 'expiresOn', ''), 'notes', nullif(btrim(source ->> 'notes'), ''))
$$;

create or replace function private.profile_change_training_value(source jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('courseName', nullif(btrim(source ->> 'courseName'), ''), 'provider', nullif(btrim(source ->> 'provider'), ''), 'completedOn', nullif(source ->> 'completedOn', ''), 'expiresOn', nullif(source ->> 'expiresOn', ''), 'hours', case when nullif(source ->> 'hours', '') is null then null else (source ->> 'hours')::numeric end, 'notes', nullif(btrim(source ->> 'notes'), ''))
$$;

create or replace function private.submit_profile_change_request(target_request_id uuid, request_note text, requested_changes jsonb, requested_documents jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid()); target_employee_id uuid; item jsonb; document jsonb; item_ordinal integer := 0;
  target_qualification_id uuid; target_certification_id uuid; target_training_record_id uuid; normalized_value jsonb;
begin
  if caller_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  select private.profile_change_employee_for_user(caller_id) into target_employee_id;
  if target_employee_id is null then raise exception 'An employee record is required.' using errcode = '42501'; end if;
  if jsonb_typeof(requested_changes) <> 'array' or jsonb_array_length(requested_changes) not between 1 and 20 then raise exception 'Provide between one and twenty changes.' using errcode = '22023'; end if;
  if jsonb_typeof(requested_documents) <> 'array' or jsonb_array_length(requested_documents) not between 1 and 10 then raise exception 'Attach between one and ten supporting documents.' using errcode = '22023'; end if;

  insert into public.profile_change_requests (id, employee_id, submitted_by_user_id, note)
  values (target_request_id, target_employee_id, caller_id, nullif(btrim(request_note), ''));

  for item in select value from jsonb_array_elements(requested_changes) loop
    item_ordinal := item_ordinal + 1;
    if item ->> 'kind' = 'contact' then
      if item ->> 'field' not in ('personalEmail', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone') then raise exception 'Invalid contact field.' using errcode = '22023'; end if;
      insert into public.profile_change_request_changes (request_id, ordinal, kind, field_key, original_value, requested_value)
      values (target_request_id, item_ordinal, 'contact', item ->> 'field', coalesce(item -> 'originalValue', 'null'::jsonb), coalesce(item -> 'requestedValue', 'null'::jsonb));
    elsif item ->> 'kind' = 'qualification' then
      if item ->> 'operation' not in ('add', 'edit', 'remove') then raise exception 'Invalid qualification operation.' using errcode = '22023'; end if;
      target_qualification_id := nullif(item ->> 'qualificationId', '')::uuid;
      if item ->> 'operation' = 'add' and (target_qualification_id is not null or item -> 'originalValue' <> 'null'::jsonb) then raise exception 'Invalid qualification addition.' using errcode = '22023'; end if;
      if item ->> 'operation' in ('edit', 'remove') and (target_qualification_id is null or item -> 'originalValue' = 'null'::jsonb or not exists (select 1 from public.qualifications where id = target_qualification_id and employee_id = target_employee_id)) then raise exception 'Invalid qualification target.' using errcode = '22023'; end if;
      normalized_value := private.profile_change_qualification_value(item -> 'requestedValue');
      if item ->> 'operation' <> 'remove' and (normalized_value ->> 'name' is null or normalized_value ->> 'awardedOn' is null) then raise exception 'Invalid qualification details.' using errcode = '22023'; end if;
      insert into public.profile_change_request_changes (request_id, ordinal, kind, operation, qualification_id, original_value, requested_value)
      values (target_request_id, item_ordinal, 'qualification', item ->> 'operation', target_qualification_id, coalesce(item -> 'originalValue', 'null'::jsonb), coalesce(item -> 'requestedValue', 'null'::jsonb));
    elsif item ->> 'kind' = 'certification' then
      if item ->> 'operation' not in ('add', 'edit', 'remove') then raise exception 'Invalid certification operation.' using errcode = '22023'; end if;
      target_certification_id := nullif(item ->> 'certificationId', '')::uuid;
      if item ->> 'operation' = 'add' and (target_certification_id is not null or item -> 'originalValue' <> 'null'::jsonb) then raise exception 'Invalid certification addition.' using errcode = '22023'; end if;
      if item ->> 'operation' in ('edit', 'remove') and (target_certification_id is null or item -> 'originalValue' = 'null'::jsonb or not exists (select 1 from public.certifications where id = target_certification_id and employee_id = target_employee_id)) then raise exception 'Invalid certification target.' using errcode = '22023'; end if;
      normalized_value := private.profile_change_certification_value(item -> 'requestedValue');
      if item ->> 'operation' <> 'remove' and (normalized_value ->> 'name' is null or normalized_value ->> 'issuedOn' is null) then raise exception 'Invalid certification details.' using errcode = '22023'; end if;
      insert into public.profile_change_request_changes (request_id, ordinal, kind, operation, certification_id, original_value, requested_value)
      values (target_request_id, item_ordinal, 'certification', item ->> 'operation', target_certification_id, coalesce(item -> 'originalValue', 'null'::jsonb), coalesce(item -> 'requestedValue', 'null'::jsonb));
    elsif item ->> 'kind' = 'training' then
      if item ->> 'operation' not in ('add', 'edit', 'remove') then raise exception 'Invalid training operation.' using errcode = '22023'; end if;
      target_training_record_id := nullif(item ->> 'trainingRecordId', '')::uuid;
      if item ->> 'operation' = 'add' and (target_training_record_id is not null or item -> 'originalValue' <> 'null'::jsonb) then raise exception 'Invalid training addition.' using errcode = '22023'; end if;
      if item ->> 'operation' in ('edit', 'remove') and (target_training_record_id is null or item -> 'originalValue' = 'null'::jsonb or not exists (select 1 from public.training_records where id = target_training_record_id and employee_id = target_employee_id)) then raise exception 'Invalid training target.' using errcode = '22023'; end if;
      normalized_value := private.profile_change_training_value(item -> 'requestedValue');
      if item ->> 'operation' <> 'remove' and (normalized_value ->> 'courseName' is null or normalized_value ->> 'provider' is null or normalized_value ->> 'completedOn' is null) then raise exception 'Invalid training details.' using errcode = '22023'; end if;
      insert into public.profile_change_request_changes (request_id, ordinal, kind, operation, training_record_id, original_value, requested_value)
      values (target_request_id, item_ordinal, 'training', item ->> 'operation', target_training_record_id, coalesce(item -> 'originalValue', 'null'::jsonb), coalesce(item -> 'requestedValue', 'null'::jsonb));
    else raise exception 'Invalid change kind.' using errcode = '22023'; end if;
  end loop;

  for document in select value from jsonb_array_elements(requested_documents) loop
    if document ->> 'objectPath' !~ ('^profile-change-requests/' || caller_id::text || '/' || target_request_id::text || '/[0-9a-f-]{36}\.(pdf|png|jpe?g|webp)$') or document ->> 'mimeType' not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') or coalesce((document ->> 'sizeBytes')::bigint, 0) not between 1 and 10485760 then raise exception 'Invalid supporting document.' using errcode = '22023'; end if;
    if not exists (select 1 from storage.objects object where object.bucket_id = 'private-documents' and object.name = document ->> 'objectPath' and object.owner_id = caller_id::text) then raise exception 'Supporting document was not uploaded by the requester.' using errcode = '42501'; end if;
    insert into public.profile_change_request_documents (request_id, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (target_request_id, document ->> 'objectPath', btrim(document ->> 'fileName'), document ->> 'mimeType', (document ->> 'sizeBytes')::bigint, caller_id);
  end loop;
  insert into public.profile_change_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'submitted');
end;
$$;

create or replace function private.decide_profile_change_request(target_request_id uuid, requested_decision text, requested_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid()); request public.profile_change_requests%rowtype; change_row public.profile_change_request_changes%rowtype;
  qualification public.qualifications%rowtype; certification public.certifications%rowtype; training public.training_records%rowtype; current_value jsonb; next_value jsonb;
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
      elsif change_row.kind = 'qualification' then
        if change_row.operation = 'add' then
          next_value := private.profile_change_qualification_value(change_row.requested_value);
          insert into public.qualifications (employee_id, name, institution, qualification_level, field_of_study, awarded_on, notes) values (request.employee_id, next_value ->> 'name', next_value ->> 'institution', next_value ->> 'qualificationLevel', next_value ->> 'fieldOfStudy', (next_value ->> 'awardedOn')::date, next_value ->> 'notes');
        else
          select * into qualification from public.qualifications where id = change_row.qualification_id and employee_id = request.employee_id for update;
          if not found or jsonb_build_object('name', qualification.name, 'institution', qualification.institution, 'qualificationLevel', qualification.qualification_level, 'fieldOfStudy', qualification.field_of_study, 'awardedOn', qualification.awarded_on::text, 'notes', qualification.notes) is distinct from change_row.original_value then raise exception 'The qualification changed while this request was pending.' using errcode = 'P0001'; end if;
          if change_row.operation = 'remove' then delete from public.qualifications where id = qualification.id; else next_value := private.profile_change_qualification_value(change_row.requested_value); update public.qualifications set name = next_value ->> 'name', institution = next_value ->> 'institution', qualification_level = next_value ->> 'qualificationLevel', field_of_study = next_value ->> 'fieldOfStudy', awarded_on = (next_value ->> 'awardedOn')::date, notes = next_value ->> 'notes' where id = qualification.id; end if;
        end if;
      elsif change_row.kind = 'certification' then
        if change_row.operation = 'add' then
          next_value := private.profile_change_certification_value(change_row.requested_value);
          insert into public.certifications (employee_id, name, issuer, credential_id, issued_on, expires_on, notes) values (request.employee_id, next_value ->> 'name', next_value ->> 'issuer', next_value ->> 'credentialId', (next_value ->> 'issuedOn')::date, (next_value ->> 'expiresOn')::date, next_value ->> 'notes');
        else
          select * into certification from public.certifications where id = change_row.certification_id and employee_id = request.employee_id for update;
          if not found or jsonb_build_object('name', certification.name, 'issuer', certification.issuer, 'credentialId', certification.credential_id, 'issuedOn', certification.issued_on::text, 'expiresOn', certification.expires_on::text, 'notes', certification.notes) is distinct from change_row.original_value then raise exception 'The certification changed while this request was pending.' using errcode = 'P0001'; end if;
          if change_row.operation = 'remove' then delete from public.certifications where id = certification.id; else next_value := private.profile_change_certification_value(change_row.requested_value); update public.certifications set name = next_value ->> 'name', issuer = next_value ->> 'issuer', credential_id = next_value ->> 'credentialId', issued_on = (next_value ->> 'issuedOn')::date, expires_on = (next_value ->> 'expiresOn')::date, notes = next_value ->> 'notes' where id = certification.id; end if;
        end if;
      elsif change_row.kind = 'training' then
        if change_row.operation = 'add' then
          next_value := private.profile_change_training_value(change_row.requested_value);
          insert into public.training_records (employee_id, course_name, provider, completed_on, expires_on, hours, notes) values (request.employee_id, next_value ->> 'courseName', next_value ->> 'provider', (next_value ->> 'completedOn')::date, (next_value ->> 'expiresOn')::date, (next_value ->> 'hours')::numeric, next_value ->> 'notes');
        else
          select * into training from public.training_records where id = change_row.training_record_id and employee_id = request.employee_id for update;
          if not found or jsonb_build_object('courseName', training.course_name, 'provider', training.provider, 'completedOn', training.completed_on::text, 'expiresOn', training.expires_on::text, 'hours', training.hours, 'notes', training.notes) is distinct from change_row.original_value then raise exception 'The training record changed while this request was pending.' using errcode = 'P0001'; end if;
          if change_row.operation = 'remove' then delete from public.training_records where id = training.id; else next_value := private.profile_change_training_value(change_row.requested_value); update public.training_records set course_name = next_value ->> 'courseName', provider = next_value ->> 'provider', completed_on = (next_value ->> 'completedOn')::date, expires_on = (next_value ->> 'expiresOn')::date, hours = (next_value ->> 'hours')::numeric, notes = next_value ->> 'notes' where id = training.id; end if;
        end if;
      end if;
    end loop;
  end if;
  update public.profile_change_requests set status = requested_decision, decision_reason = nullif(btrim(requested_reason), ''), decided_by_user_id = caller_id, decided_at = now(), updated_at = now() where id = target_request_id;
  insert into public.profile_change_request_history (request_id, actor_user_id, event_type, metadata) values (target_request_id, caller_id, requested_decision, jsonb_build_object('reason', nullif(btrim(requested_reason), '')));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'profile_change_requests', target_request_id::text, requested_decision, jsonb_build_object('employee_id', request.employee_id));
  insert into public.notifications (recipient_user_id, type, title, body, link) values (request.submitted_by_user_id, 'profile_change_decision', 'Profile change request ' || requested_decision, case when requested_decision = 'approved' then 'Your profile change request was approved.' else 'Your profile change request was rejected.' end, '/employee/profile/change-requests/' || target_request_id::text);
end;
$$;

revoke all on function private.profile_change_certification_value(jsonb), private.profile_change_training_value(jsonb) from public, anon, authenticated;
