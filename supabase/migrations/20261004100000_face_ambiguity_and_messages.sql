-- Tester feedback (2026-10-04): a duplicate face must say so plainly, and enrollment must refuse
-- faces the kiosk could never tell apart (within match_threshold + ambiguity_margin of another
-- employee). Existing enrollments are not re-checked.

create or replace function private.enroll_employee_face(target_employee_id uuid, target_descriptor real[], target_sample_count integer, target_consent_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  settings_row private.face_recognition_settings%rowtype;
  conflicting_employee uuid;
  was_enrolled boolean;
  account_active boolean;
begin
  if target_consent_confirmed is not true then
    raise exception 'Confirm the employee consented to face registration.' using errcode = '22023';
  end if;
  if not private.is_valid_face_descriptor(target_descriptor) or target_sample_count is null or target_sample_count not between 3 and 10 then
    raise exception 'The face sample is invalid. Capture the face again.' using errcode = '22023';
  end if;
  select * into settings_row from private.face_recognition_settings where id;

  perform 1 from public.employees where id = target_employee_id for share;
  if not found then
    raise exception 'Employee was not found.' using errcode = 'P0001';
  end if;
  -- Retention is tied to the linked account, so an employee needs an active login to register.
  -- The share lock makes a concurrent deactivation wait until this enrollment is visible to its purge trigger.
  select profile.is_active into account_active
  from public.employees employee
  join public.profiles profile on profile.id = employee.profile_id
  where employee.id = target_employee_id
  for share of profile;
  if account_active is not true then
    raise exception 'Only employees with an active linked account can be registered for face attendance.' using errcode = 'P0001';
  end if;

  -- Serialize enrollments so two concurrent registrations cannot both pass the similarity check.
  perform pg_advisory_xact_lock(hashtext('face_enrollment'));

  -- The kiosk rejects a scan whose two best matches are within ambiguity_margin, so a face this
  -- close to another employee could never be identified reliably.
  select enrollment.employee_id into conflicting_employee
  from private.employee_face_enrollments enrollment
  where enrollment.employee_id <> target_employee_id
    and private.face_descriptor_distance(enrollment.descriptor, target_descriptor) <= settings_row.match_threshold + settings_row.ambiguity_margin
  limit 1;
  if found then
    raise exception 'This face is already registered to another employee. Each employee can register only their own face.' using errcode = '23505';
  end if;

  select exists (select 1 from private.employee_face_enrollments where employee_id = target_employee_id) into was_enrolled;

  -- Re-registration replaces the old descriptor only inside this successful transaction.
  insert into private.employee_face_enrollments (employee_id, descriptor, sample_count, consent_confirmed_at, enrolled_by_user_id)
  values (target_employee_id, target_descriptor, target_sample_count, now(), caller_id)
  on conflict (employee_id) do update
    set descriptor = excluded.descriptor,
        sample_count = excluded.sample_count,
        consent_confirmed_at = excluded.consent_confirmed_at,
        enrolled_by_user_id = excluded.enrolled_by_user_id,
        updated_at = now();

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'employee_face_enrollments', target_employee_id::text, case when was_enrolled then 're_registered' else 'enrolled' end, jsonb_build_object('sample_count', target_sample_count));

  return jsonb_build_object('employeeId', target_employee_id, 'status', case when was_enrolled then 're_registered' else 'enrolled' end);
end;
$$;

-- A kiosk scan whose two best matches are too close is now its own outcome, so the person is told
-- to see HR instead of "Face not recognized.". It still writes no attendance and names no employee.
alter table private.face_attendance_scans
  drop constraint face_attendance_scans_outcome_check,
  add constraint face_attendance_scans_outcome_check
    check (outcome in ('time_in', 'time_out', 'already_recorded', 'rejected', 'not_recognized', 'ambiguous')),
  drop constraint face_attendance_scans_check,
  add constraint face_attendance_scans_no_employee_check
    check ((outcome in ('not_recognized', 'ambiguous')) = (employee_id is null));

drop function private.reject_face_scan(uuid, double precision, uuid, jsonb);

-- Records a scan that matched no one, or more than one employee. Writes no attendance.
create function private.reject_face_scan(target_scan_id uuid, target_distance double precision, caller_id uuid, target_metadata jsonb, target_outcome text default 'not_recognized')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare scan_row private.face_attendance_scans%rowtype;
begin
  if target_outcome not in ('not_recognized', 'ambiguous') then
    raise exception 'Unsupported rejected scan outcome.' using errcode = '22023';
  end if;
  insert into private.face_attendance_scans (id, outcome, match_distance, message, recorded_by_user_id)
  values (
    target_scan_id,
    target_outcome,
    target_distance,
    case target_outcome when 'ambiguous' then 'More than one employee matches this face. Please see HR.' else 'Face not recognized.' end,
    caller_id
  )
  returning * into scan_row;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'face_attendance_scans', target_scan_id::text, target_outcome, target_metadata);
  return private.face_scan_result(scan_row);
end;
$$;

revoke all on function private.reject_face_scan(uuid, double precision, uuid, jsonb, text) from public, anon, authenticated;

-- HR kiosk: identify (1:N) among every enrollment.
create or replace function private.record_face_attendance(target_scan_id uuid, target_descriptor real[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  previous jsonb := private.previous_face_scan(target_scan_id, caller_id);
  settings_row private.face_recognition_settings%rowtype;
  best_employee uuid;
  best_distance double precision;
  runner_up_distance double precision;
begin
  if previous is not null then
    return previous;
  end if;
  if not private.is_valid_face_descriptor(target_descriptor) then
    raise exception 'The face sample is invalid. Scan again.' using errcode = '22023';
  end if;
  settings_row := private.require_face_attendance_enabled();

  select ranked.employee_id, ranked.distance into best_employee, best_distance
  from (
    select enrollment.employee_id, private.face_descriptor_distance(enrollment.descriptor, target_descriptor) as distance
    from private.employee_face_enrollments enrollment
  ) ranked
  order by ranked.distance
  limit 1;

  select ranked.distance into runner_up_distance
  from (
    select private.face_descriptor_distance(enrollment.descriptor, target_descriptor) as distance
    from private.employee_face_enrollments enrollment
    where enrollment.employee_id <> best_employee
  ) ranked
  order by ranked.distance
  limit 1;

  if best_employee is null or best_distance > settings_row.match_threshold then
    return private.reject_face_scan(target_scan_id, best_distance, caller_id, jsonb_build_object('mode', 'kiosk'));
  end if;
  if runner_up_distance is not null and runner_up_distance - best_distance < settings_row.ambiguity_margin then
    return private.reject_face_scan(target_scan_id, best_distance, caller_id, jsonb_build_object('mode', 'kiosk'), 'ambiguous');
  end if;

  return private.write_face_attendance(target_scan_id, best_employee, best_distance, caller_id, 'kiosk');
end;
$$;
