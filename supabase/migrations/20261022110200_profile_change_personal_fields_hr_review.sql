-- Final revisions: an employee can ask to correct every personal field HR entered on the
-- official record (badge / ID number, names, birth details, gender, civil status, religion,
-- contact details, emergency contact, government IDs, and Date Entered Service), plus the
-- eligibility rating. HR reviews the request (system administrators keep access) and every
-- active HR account is notified when a request is submitted.

-- 1. Allowed personal fields --------------------------------------------------------------

-- Maps a request field key to its employees column. Unknown keys return null.
create or replace function private.profile_change_employee_column(field_key text)
returns text language sql immutable set search_path = '' as $$
  select case field_key
    when 'employeeNumber' then 'employee_number'
    when 'firstName' then 'first_name'
    when 'middleName' then 'middle_name'
    when 'lastName' then 'last_name'
    when 'qualifier' then 'qualifier'
    when 'placeOfBirth' then 'place_of_birth'
    when 'dateOfBirth' then 'date_of_birth'
    when 'gender' then 'gender'
    when 'civilStatus' then 'civil_status'
    when 'religion' then 'religion'
    when 'personalEmail' then 'personal_email'
    when 'phone' then 'phone'
    when 'address' then 'address'
    when 'emergencyContactName' then 'emergency_contact_name'
    when 'emergencyContactPhone' then 'emergency_contact_phone'
    when 'emergencyContactRelationship' then 'emergency_contact_relationship'
    when 'sssNumber' then 'sss_number'
    when 'philhealthNumber' then 'philhealth_number'
    when 'gsisNumber' then 'gsis_number'
    when 'pagibigNumber' then 'pagibig_number'
    when 'employmentStartedOn' then 'employment_started_on'
    else null
  end
$$;

-- The requested value as it is written to the record: trimmed, blank as null, email in lower
-- case and the badge / ID number in upper case (matching the employees checks).
create or replace function private.profile_change_personal_value(field_key text, requested jsonb)
returns text language sql immutable set search_path = '' as $$
  select case
    when field_key = 'personalEmail' then lower(nullif(btrim(requested #>> '{}'), ''))
    when field_key = 'employeeNumber' then upper(nullif(btrim(requested #>> '{}'), ''))
    else nullif(btrim(requested #>> '{}'), '')
  end
$$;

-- Returns why a requested personal value is invalid, or null when it can be submitted.
create or replace function private.profile_change_personal_value_error(field_key text, value text)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if private.profile_change_employee_column(field_key) is null then return 'Invalid personal field.'; end if;
  if value is null then
    if field_key in ('middleName', 'qualifier', 'sssNumber', 'philhealthNumber', 'gsisNumber', 'pagibigNumber') then return null; end if;
    return 'A value is required for this field.';
  end if;
  return case
    when field_key = 'employeeNumber' and value !~ '^([0-9]-[0-9]{5}|[0-9]{8})$' then 'Badge number must be 6 digits in the format 0-00000, or an 8-digit ID number for NUP.'
    when field_key in ('firstName', 'middleName', 'lastName') and char_length(value) > 80 then 'Names can have at most 80 characters.'
    when field_key = 'qualifier' and char_length(value) > 40 then 'The qualifier can have at most 40 characters.'
    when field_key = 'placeOfBirth' and char_length(value) > 160 then 'The place of birth can have at most 160 characters.'
    when field_key = 'religion' and char_length(value) > 120 then 'The religion can have at most 120 characters.'
    when field_key in ('dateOfBirth', 'employmentStartedOn') and (value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or not pg_catalog.pg_input_is_valid(value, 'date')) then 'Enter a valid date.'
    when field_key in ('dateOfBirth', 'employmentStartedOn') and value::date > current_date then 'The date cannot be in the future.'
    when field_key = 'gender' and value not in ('female', 'male') then 'Choose a gender.'
    when field_key = 'civilStatus' and value not in ('single', 'married', 'widowed', 'separated', 'divorced') then 'Choose a civil status.'
    when field_key = 'emergencyContactRelationship' and value not in ('spouse', 'parent', 'child', 'sibling', 'other') then 'Choose the emergency contact relationship.'
    when field_key = 'personalEmail' and value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then 'Enter a valid personal email address.'
    when field_key in ('phone', 'emergencyContactPhone') and char_length(value) not between 3 and 32 then 'Enter a valid phone number.'
    when field_key = 'address' and char_length(value) not between 3 and 500 then 'The address must have 3 to 500 characters.'
    when field_key = 'emergencyContactName' and char_length(value) not between 2 and 160 then 'The emergency contact name must have 2 to 160 characters.'
    when field_key = 'sssNumber' and value !~ '^[0-9]{10}$' then 'Enter a 10-digit SSS number.'
    when field_key = 'philhealthNumber' and value !~ '^[0-9]{12}$' then 'Enter a 12-digit PhilHealth number.'
    when field_key = 'gsisNumber' and value !~ '^[0-9]{11}$' then 'Enter an 11-digit GSIS number.'
    when field_key = 'pagibigNumber' and value !~ '^[0-9]{12}$' then 'Enter a 12-digit Pag-IBIG number.'
    else null
  end;
end;
$$;

alter table public.profile_change_request_changes drop constraint profile_change_request_changes_shape_check;
alter table public.profile_change_request_changes
  add constraint profile_change_request_changes_shape_check check (
    (kind = 'contact' and field_key in (
      'employeeNumber', 'firstName', 'middleName', 'lastName', 'qualifier', 'placeOfBirth', 'dateOfBirth', 'gender',
      'civilStatus', 'religion', 'personalEmail', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone',
      'emergencyContactRelationship', 'sssNumber', 'philhealthNumber', 'gsisNumber', 'pagibigNumber', 'employmentStartedOn'
    ) and operation is null and qualification_id is null and certification_id is null and training_record_id is null)
    or (kind = 'qualification' and field_key is null and operation is not null and certification_id is null and training_record_id is null)
    or (kind = 'certification' and field_key is null and operation is not null and qualification_id is null and training_record_id is null)
    or (kind = 'training' and field_key is null and operation is not null and qualification_id is null and certification_id is null)
  );

-- 2. Eligibility rating in request snapshots --------------------------------------------------

create or replace function private.profile_change_qualification_value(source jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'name', source ->> 'name',
    'institution', source ->> 'institution',
    'qualificationLevel', nullif(source ->> 'qualificationLevel', ''),
    'fieldOfStudy', nullif(source ->> 'fieldOfStudy', ''),
    'awardedOn', source ->> 'awardedOn',
    'notes', nullif(source ->> 'notes', ''),
    'rating', case when nullif(source ->> 'rating', '') is null then null else (source ->> 'rating')::numeric end
  )
$$;

-- The saved eligibility as compared on approval. Snapshots taken before ratings existed have
-- no rating key, so the rating is left out of the comparison for them.
create or replace function private.profile_change_qualification_snapshot(qualification public.qualifications, original jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when original ? 'rating' then snapshot else snapshot - 'rating' end
  from (select jsonb_build_object(
    'name', qualification.name, 'institution', qualification.institution, 'qualificationLevel', qualification.qualification_level,
    'fieldOfStudy', qualification.field_of_study, 'awardedOn', qualification.awarded_on::text, 'notes', qualification.notes,
    'rating', qualification.rating
  ) as snapshot) built
$$;

-- 3. Submission -------------------------------------------------------------------------------

create or replace function private.submit_profile_change_request(target_request_id uuid, request_note text, requested_changes jsonb, requested_documents jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid()); target_employee_id uuid; item jsonb; document jsonb; item_ordinal integer := 0;
  target_qualification_id uuid; target_certification_id uuid; target_training_record_id uuid; normalized_value jsonb;
  value_error text; requested_rating text; employee_name text;
begin
  if caller_id is null then raise exception 'Authenticated user required.' using errcode = '42501'; end if;
  select private.profile_change_employee_for_user(caller_id) into target_employee_id;
  if target_employee_id is null then raise exception 'An employee record is required.' using errcode = '42501'; end if;
  if jsonb_typeof(requested_changes) <> 'array' or jsonb_array_length(requested_changes) not between 1 and 30 then raise exception 'Provide between one and thirty changes.' using errcode = '22023'; end if;
  if jsonb_typeof(requested_documents) <> 'array' or jsonb_array_length(requested_documents) not between 1 and 10 then raise exception 'Attach between one and ten supporting documents.' using errcode = '22023'; end if;

  insert into public.profile_change_requests (id, employee_id, submitted_by_user_id, note)
  values (target_request_id, target_employee_id, caller_id, nullif(btrim(request_note), ''));

  for item in select value from jsonb_array_elements(requested_changes) loop
    item_ordinal := item_ordinal + 1;
    if item ->> 'kind' = 'contact' then
      if private.profile_change_employee_column(item ->> 'field') is null then raise exception 'Invalid personal field.' using errcode = '22023'; end if;
      if exists (select 1 from public.profile_change_request_changes where request_id = target_request_id and kind = 'contact' and field_key = item ->> 'field') then
        raise exception 'Each personal field can be requested only once per request.' using errcode = '22023';
      end if;
      value_error := private.profile_change_personal_value_error(item ->> 'field', private.profile_change_personal_value(item ->> 'field', coalesce(item -> 'requestedValue', 'null'::jsonb)));
      if value_error is not null then raise exception '%', value_error using errcode = '22023'; end if;
      insert into public.profile_change_request_changes (request_id, ordinal, kind, field_key, original_value, requested_value)
      values (target_request_id, item_ordinal, 'contact', item ->> 'field', coalesce(item -> 'originalValue', 'null'::jsonb), coalesce(item -> 'requestedValue', 'null'::jsonb));
    elsif item ->> 'kind' = 'qualification' then
      if item ->> 'operation' not in ('add', 'edit', 'remove') then raise exception 'Invalid qualification operation.' using errcode = '22023'; end if;
      target_qualification_id := nullif(item ->> 'qualificationId', '')::uuid;
      if item ->> 'operation' = 'add' and (target_qualification_id is not null or item -> 'originalValue' <> 'null'::jsonb) then raise exception 'Invalid qualification addition.' using errcode = '22023'; end if;
      if item ->> 'operation' in ('edit', 'remove') and (target_qualification_id is null or item -> 'originalValue' = 'null'::jsonb or not exists (select 1 from public.qualifications where id = target_qualification_id and employee_id = target_employee_id)) then raise exception 'Invalid qualification target.' using errcode = '22023'; end if;
      if item ->> 'operation' <> 'remove' then
        requested_rating := nullif(item -> 'requestedValue' ->> 'rating', '');
        if requested_rating is not null and (requested_rating !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' or requested_rating::numeric > 100) then
          raise exception 'Enter a rating from 0 to 100 percent.' using errcode = '22023';
        end if;
        normalized_value := private.profile_change_qualification_value(item -> 'requestedValue');
        if normalized_value ->> 'name' is null or normalized_value ->> 'awardedOn' is null then raise exception 'Invalid qualification details.' using errcode = '22023'; end if;
      end if;
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
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'profile_change_requests', target_request_id::text, 'submitted', jsonb_build_object('employee_id', target_employee_id));

  -- Every active HR account (other than the requester) is told a request awaits review.
  select btrim(employee.first_name || ' ' || employee.last_name) into employee_name from public.employees employee where employee.id = target_employee_id;
  insert into public.notifications (recipient_user_id, type, title, body, link)
  select role.user_id, 'profile_change_submitted', 'Profile change request submitted',
    left(coalesce(nullif(employee_name, ''), 'An employee') || ' asked to update their personal record. Review the request and approve or reject it.', 2000),
    '/hr/profile-requests/' || target_request_id::text
  from public.user_roles role join public.profiles profile on profile.id = role.user_id
  where role.role = 'hr_personnel'::public.app_role and profile.is_active and role.user_id <> caller_id;
end;
$$;

-- Address changes were blocked in the public wrapper; every personal field is now accepted.
create or replace function public.submit_profile_change_request(target_request_id uuid, request_note text, requested_changes jsonb, requested_documents jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.submit_profile_change_request(target_request_id, request_note, requested_changes, requested_documents);
end;
$$;

-- 4. HR decision ------------------------------------------------------------------------------

create or replace function private.decide_profile_change_request(target_request_id uuid, requested_decision text, requested_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid()); request public.profile_change_requests%rowtype; change_row public.profile_change_request_changes%rowtype;
  qualification public.qualifications%rowtype; certification public.certifications%rowtype; training public.training_records%rowtype; current_value jsonb; next_value jsonb;
  target_column text; next_text text; value_error text;
begin
  if caller_id is null or not exists (
    select 1 from public.user_roles role join public.profiles profile on profile.id = role.user_id
    where role.user_id = caller_id and role.role in ('hr_personnel'::public.app_role, 'system_administrator'::public.app_role) and profile.is_active
  ) then raise exception 'HR access is required.' using errcode = '42501'; end if;
  if requested_decision not in ('approved', 'rejected') or (requested_decision = 'rejected' and nullif(btrim(requested_reason), '') is null) then raise exception 'Invalid decision.' using errcode = '22023'; end if;
  select * into request from public.profile_change_requests where id = target_request_id for update;
  if not found then raise exception 'Profile change request not found.' using errcode = 'P0002'; end if;
  if request.submitted_by_user_id = caller_id then raise exception 'You cannot review your own profile change request.' using errcode = '42501'; end if;
  if request.status <> 'pending' then raise exception 'Only pending requests can be decided.' using errcode = 'P0001'; end if;
  if requested_decision = 'approved' then
    for change_row in select * from public.profile_change_request_changes where request_id = target_request_id order by ordinal loop
      if change_row.kind = 'contact' then
        target_column := private.profile_change_employee_column(change_row.field_key);
        if target_column is null then raise exception 'Invalid personal field.' using errcode = '22023'; end if;
        execute format('select to_jsonb(employee.%I) from public.employees employee where employee.id = $1', target_column) into current_value using request.employee_id;
        current_value := coalesce(current_value, 'null'::jsonb);
        if current_value is distinct from change_row.original_value then raise exception 'The official record changed while this request was pending.' using errcode = 'P0001'; end if;
        next_text := private.profile_change_personal_value(change_row.field_key, change_row.requested_value);
        value_error := private.profile_change_personal_value_error(change_row.field_key, next_text);
        if value_error is not null then raise exception '%', value_error using errcode = '22023'; end if;
        if target_column in ('date_of_birth', 'employment_started_on') then
          execute format('update public.employees set %I = $1::date where id = $2', target_column) using next_text, request.employee_id;
        else
          execute format('update public.employees set %I = $1 where id = $2', target_column) using next_text, request.employee_id;
        end if;
      elsif change_row.kind = 'qualification' then
        if change_row.operation = 'add' then
          next_value := private.profile_change_qualification_value(change_row.requested_value);
          insert into public.qualifications (employee_id, name, institution, qualification_level, field_of_study, awarded_on, notes, rating) values (request.employee_id, next_value ->> 'name', next_value ->> 'institution', next_value ->> 'qualificationLevel', next_value ->> 'fieldOfStudy', (next_value ->> 'awardedOn')::date, next_value ->> 'notes', (next_value ->> 'rating')::numeric);
        else
          select * into qualification from public.qualifications where id = change_row.qualification_id and employee_id = request.employee_id for update;
          if not found or private.profile_change_qualification_snapshot(qualification, change_row.original_value) is distinct from change_row.original_value then raise exception 'The qualification changed while this request was pending.' using errcode = 'P0001'; end if;
          if change_row.operation = 'remove' then delete from public.qualifications where id = qualification.id; else next_value := private.profile_change_qualification_value(change_row.requested_value); update public.qualifications set name = next_value ->> 'name', institution = next_value ->> 'institution', qualification_level = next_value ->> 'qualificationLevel', field_of_study = next_value ->> 'fieldOfStudy', awarded_on = (next_value ->> 'awardedOn')::date, notes = next_value ->> 'notes', rating = (next_value ->> 'rating')::numeric where id = qualification.id; end if;
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

revoke all on function
  private.profile_change_employee_column(text),
  private.profile_change_personal_value(text, jsonb),
  private.profile_change_personal_value_error(text, text),
  private.profile_change_qualification_snapshot(public.qualifications, jsonb),
  private.profile_change_qualification_value(jsonb),
  private.submit_profile_change_request(uuid, text, jsonb, jsonb),
  private.decide_profile_change_request(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.submit_profile_change_request(uuid, text, jsonb, jsonb), public.decide_profile_change_request(uuid, text, text) from public, anon;
grant execute on function public.submit_profile_change_request(uuid, text, jsonb, jsonb), public.decide_profile_change_request(uuid, text, text) to authenticated;

-- 5. HR can read requests and their evidence ------------------------------------------------------

drop policy profile_change_requests_select_own_or_admin on public.profile_change_requests;
create policy profile_change_requests_select_own_or_admin on public.profile_change_requests for select to authenticated using (
  submitted_by_user_id = (select auth.uid())
  or (select private.current_user_has_role('hr_personnel'::public.app_role))
  or (select private.current_user_has_role('system_administrator'::public.app_role))
);

drop policy profile_change_request_changes_select_own_or_admin on public.profile_change_request_changes;
create policy profile_change_request_changes_select_own_or_admin on public.profile_change_request_changes for select to authenticated using (
  exists (select 1 from public.profile_change_requests request where request.id = profile_change_request_changes.request_id and (
    request.submitted_by_user_id = (select auth.uid())
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  ))
);

drop policy profile_change_request_documents_select_own_or_admin on public.profile_change_request_documents;
create policy profile_change_request_documents_select_own_or_admin on public.profile_change_request_documents for select to authenticated using (
  exists (select 1 from public.profile_change_requests request where request.id = profile_change_request_documents.request_id and (
    request.submitted_by_user_id = (select auth.uid())
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  ))
);

drop policy profile_change_request_history_select_own_or_admin on public.profile_change_request_history;
create policy profile_change_request_history_select_own_or_admin on public.profile_change_request_history for select to authenticated using (
  exists (select 1 from public.profile_change_requests request where request.id = profile_change_request_history.request_id and (
    request.submitted_by_user_id = (select auth.uid())
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  ))
);

drop policy private_documents_profile_change_read_admin on storage.objects;
create policy private_documents_profile_change_read_admin on storage.objects for select to authenticated using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'profile-change-requests'
  and (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  )
  and exists (select 1 from public.profile_change_request_documents document where document.object_path = objects.name)
);
