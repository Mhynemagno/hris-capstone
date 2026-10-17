-- Tell the authorised HR enrolment operator which existing registration needs review.
-- This does not expose descriptors or matching distances.
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
  conflicting_employee_label text;
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

  select profile.is_active into account_active
  from public.profiles profile
  where profile.id = (select employee.profile_id from public.employees employee where employee.id = target_employee_id)
  for share of profile;
  if account_active is false then
    raise exception 'Only employees without a deactivated linked account can be registered for face attendance.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('face_enrollment'));

  select enrollment.employee_id into conflicting_employee
  from private.employee_face_enrollments enrollment
  where enrollment.employee_id <> target_employee_id
    and private.face_descriptor_distance(enrollment.descriptor, target_descriptor) <= settings_row.match_threshold + settings_row.ambiguity_margin
  limit 1;
  if found then
    select concat_ws(' ', employee.first_name, employee.last_name) || ' (' || employee.employee_number || ')'
      into conflicting_employee_label
    from public.employees employee
    where employee.id = conflicting_employee;

    raise exception 'This scan is too similar to the face registered to %. This employee is not registered yet. Review or delete that face registration and then try again.', coalesce(conflicting_employee_label, 'another employee')
      using errcode = '23505';
  end if;

  select exists (select 1 from private.employee_face_enrollments where employee_id = target_employee_id) into was_enrolled;

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
