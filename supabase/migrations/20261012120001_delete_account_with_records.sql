-- Administrators can always delete an account; its records go with it (client request, Oct 2026).
-- Before this, any record that pointed at the account blocked the delete, and the final auth delete could
-- still fail. "Not your own account" and "keep one active System Administrator" still apply.
--
-- What happens to the account's data:
--   * removed: the personnel record and everything filed under it (leave, attendance, deployments,
--     evaluations, promotion dockets, profile change requests, record history), the applicant profile with
--     its applications and documents, and its notifications;
--   * cleared: the person's name on other people's records (e.g. "decided by" on a leave request).

-- 1. "Start date must be today or later" was a CHECK, which Postgres re-tests on every update of the row.
--    Any later change to a past leave request (such as clearing "decided by") failed. Enforce it only when
--    a start date is set or changed.
alter table public.leave_requests drop constraint leave_requests_starts_on_check;

create function private.enforce_leave_request_start_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.starts_on is distinct from old.starts_on) and new.starts_on < current_date then
    raise exception 'new row for relation "leave_requests" violates check constraint "leave_requests_starts_on_check"'
      using errcode = '23514', constraint = 'leave_requests_starts_on_check';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_leave_request_start_date() from public, anon, authenticated;

create trigger leave_requests_enforce_start_date
  before insert or update of starts_on on public.leave_requests
  for each row execute function private.enforce_leave_request_start_date();

-- 2. Two "uploaded/submitted by" columns blocked deleting the uploader. Keep the row, clear the name.
alter table public.application_stage_documents alter column uploaded_by_user_id drop not null;
alter table public.application_stage_documents drop constraint application_stage_documents_uploaded_by_user_id_fkey;
alter table public.application_stage_documents add constraint application_stage_documents_uploaded_by_user_id_fkey
  foreign key (uploaded_by_user_id) references public.profiles (id) on delete set null;

alter table public.deployment_reports alter column submitted_by_user_id drop not null;
alter table public.deployment_reports drop constraint deployment_reports_submitted_by_user_id_fkey;
alter table public.deployment_reports add constraint deployment_reports_submitted_by_user_id_fkey
  foreign key (submitted_by_user_id) references public.profiles (id) on delete set null;

-- 3. The delete preview no longer lists blockers for accounts; it lists what will be removed.
create or replace function private.deletion_impact(entity_type text, entity_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  caller_id uuid;
  record_label text;
  blockers jsonb := '[]'::jsonb;
  removes jsonb := '[]'::jsonb;
  reasons text[] := '{}';
  alternative text;
  target_uuid uuid;
  target_bigint bigint;
  target_role public.app_role;
  target_active boolean;
  job_status text;
  requirement_count bigint;
begin
  case entity_type
    when 'leave_type' then
      caller_id := private.require_active_hr();
      target_uuid := entity_id::uuid;
      select name into record_label from public.leave_types where id = target_uuid;
      if record_label is null then raise exception 'Leave type was not found.' using errcode = 'P0001'; end if;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.leave_types'::regclass, entity_id, true) refs;
      alternative := 'Deactivate the leave type so employees can no longer choose it; past requests keep their type.';

    when 'promotion_criterion' then
      caller_id := private.require_active_hr();
      target_uuid := entity_id::uuid;
      select rank.name into record_label
      from public.promotion_criteria criterion
      join public.ranks rank on rank.id = criterion.target_rank_id
      where criterion.id = target_uuid;
      if record_label is null then raise exception 'Promotion criterion was not found.' using errcode = 'P0001'; end if;
      record_label := 'Promotion criteria for ' || record_label;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.promotion_criteria'::regclass, entity_id, true, array['promotion_criteria_requirements']) refs;
      select count(*) into requirement_count from public.promotion_criteria_requirements where criterion_id = target_uuid;
      if requirement_count > 0 then
        removes := removes || jsonb_build_object('label', 'required credentials', 'count', requirement_count);
      end if;
      alternative := 'Deactivate the criteria so they are no longer used for new evaluations; past evaluations stay intact.';

    when 'job_opening' then
      caller_id := private.require_active_hr();
      target_bigint := entity_id::bigint;
      select title, status into record_label, job_status from public.job_openings where id = target_bigint;
      if record_label is null then raise exception 'Job opening was not found.' using errcode = 'P0001'; end if;
      if job_status <> 'draft' then
        reasons := array_append(reasons, 'Only draft openings can be deleted; published or closed openings are part of the recruitment record.'::text);
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.job_openings'::regclass, entity_id, true) refs;
      select count(*) into requirement_count from public.job_qualification_criteria where job_opening_id = target_bigint;
      if requirement_count > 0 then
        removes := removes || jsonb_build_object('label', 'qualification criteria', 'count', requirement_count);
      end if;
      alternative := 'Withdraw the opening to close it to applicants while keeping its applications and history.';

    when 'managed_user' then
      caller_id := private.require_active_admin();
      target_uuid := entity_id::uuid;
      select coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Account'), user_role.role, profile.is_active
        into record_label, target_role, target_active
      from public.profiles profile
      left join public.user_roles user_role on user_role.user_id = profile.id
      where profile.id = target_uuid;
      if record_label is null then raise exception 'Managed account was not found.' using errcode = 'P0001'; end if;
      if target_uuid = caller_id then
        reasons := array_append(reasons, 'You cannot delete your own account.'::text);
      end if;
      if target_role = 'system_administrator'::public.app_role and target_active and (
        select count(*) from public.user_roles user_role
        join public.profiles profile on profile.id = user_role.user_id
        where user_role.role = 'system_administrator'::public.app_role and profile.is_active
      ) <= 1 then
        reasons := array_append(reasons, 'At least one active system administrator is required.'::text);
      end if;

      -- Nothing blocks an account delete any more: private.remove_managed_account_data removes what the
      -- account owns, and the person's name is cleared from other people's records.
      select coalesce(jsonb_agg(item), '[]') into removes from (
        select jsonb_build_object('label', 'personnel record', 'count', count(*)) as item
        from public.employees where profile_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'leave requests', 'count', count(*))
        from public.leave_requests request join public.employees employee on employee.id = request.employee_id
        where employee.profile_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'attendance logs', 'count', count(*))
        from public.attendance_logs log join public.employees employee on employee.id = log.employee_id
        where employee.profile_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'deployments', 'count', count(*))
        from public.deployments deployment join public.employees employee on employee.id = deployment.employee_id
        where employee.profile_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'applicant profile', 'count', count(*))
        from public.applicants where profile_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'job applications', 'count', count(*))
        from public.applications application join public.applicants applicant on applicant.id = application.applicant_id
        where applicant.profile_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'notifications', 'count', count(*))
        from public.notifications where recipient_user_id = target_uuid having count(*) > 0
      ) removed;

    when 'notification' then
      caller_id := (select auth.uid());
      target_uuid := entity_id::uuid;
      select title into record_label from public.notifications
      where id = target_uuid and recipient_user_id = caller_id;
      if caller_id is null or record_label is null then raise exception 'Notification was not found.' using errcode = 'P0001'; end if;
      alternative := 'Mark the notification as read instead.';

    when 'employee' then
      caller_id := private.require_active_hr();
      target_uuid := entity_id::uuid;
      select concat_ws(' ', employee.first_name, employee.last_name) || ' (' || employee.employee_number || ')'
        into record_label from public.employees employee where employee.id = target_uuid;
      if record_label is null then raise exception 'Personnel record was not found.' using errcode = 'P0001'; end if;
      -- Attendance, leave, deployments, evaluations, requests, and hires are official records and block
      -- the delete. The record history is written by the personnel-record trigger itself, so it is removed
      -- with the record (a full snapshot is kept in the audit log).
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.employees'::regclass, entity_id, true, array['employee_record_history']) refs;
      select coalesce(jsonb_agg(item), '[]') into removes from (
        select jsonb_build_object('label', 'service history entries', 'count', count(*)) as item
        from public.service_history where employee_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'qualifications', 'count', count(*))
        from public.qualifications where employee_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'certifications', 'count', count(*))
        from public.certifications where employee_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'training records', 'count', count(*))
        from public.training_records where employee_id = target_uuid having count(*) > 0
      ) removed;
      alternative := 'Keep the record and set an employment end date to show the person has left the service.';

    else
      raise exception 'Deletion is not supported for this record type.' using errcode = '22023';
  end case;

  return jsonb_build_object(
    'entityType', entity_type,
    'entityId', entity_id,
    'label', record_label,
    'canDelete', jsonb_array_length(blockers) = 0 and cardinality(reasons) = 0,
    'blockers', blockers,
    'reasons', to_jsonb(reasons),
    'removes', removes,
    'alternative', alternative
  );
exception
  when invalid_text_representation then
    raise exception 'The record identifier is not valid.' using errcode = '22023';
end;
$function$;

-- 4. Removes everything the account owns, so the auth delete that follows cannot be blocked.
--    Returns the storage objects to remove: { bucket: [paths] }.
create function private.remove_managed_account_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  impact jsonb;
  applicant_ids uuid[];
  application_ids uuid[];
  employee_ids uuid[];
  leave_ids uuid[];
  deployment_ids uuid[];
  evaluation_ids uuid[];
  attendance_ids uuid[];
  removed_employees jsonb;
  storage_paths jsonb;
begin
  lock table public.user_roles, public.profiles in share row exclusive mode;
  -- Re-checks the caller is an active administrator, not deleting themselves or the last administrator.
  impact := private.assert_deletable('managed_user', target_user_id::text);

  select coalesce(array_agg(id), '{}') into applicant_ids from public.applicants where profile_id = target_user_id;
  select coalesce(array_agg(id), '{}') into application_ids from public.applications where applicant_id = any(applicant_ids);
  select coalesce(array_agg(id), '{}') into employee_ids from public.employees where profile_id = target_user_id;
  select coalesce(array_agg(id), '{}') into leave_ids from public.leave_requests where employee_id = any(employee_ids);
  select coalesce(array_agg(id), '{}') into deployment_ids from public.deployments where employee_id = any(employee_ids);
  select coalesce(array_agg(id), '{}') into evaluation_ids from public.promotion_evaluations where employee_id = any(employee_ids);
  select coalesce(array_agg(id), '{}') into attendance_ids from public.attendance_logs where employee_id = any(employee_ids);

  select jsonb_strip_nulls(jsonb_build_object(
    'applicant-documents', (select jsonb_agg(object_path) from public.applicant_documents where application_id = any(application_ids)),
    'recruitment-stage-documents', (select jsonb_agg(object_path) from public.application_stage_documents where application_id = any(application_ids)),
    'applicant-profile-documents', (select jsonb_agg(object_path) from public.applicant_profile_documents where applicant_id = any(applicant_ids)),
    'applicant-profile-photos', (select jsonb_agg(profile_image_path) from public.applicants where id = any(applicant_ids) and profile_image_path is not null),
    'employee-profile-photos', (select jsonb_agg(profile_image_path) from public.employees where id = any(employee_ids) and profile_image_path is not null),
    'personnel-documents', (select jsonb_agg(path) from (
      select document_path as path from public.qualifications where employee_id = any(employee_ids) and document_path is not null
      union all
      select document_path from public.certifications where employee_id = any(employee_ids) and document_path is not null
    ) documents),
    'deployment-reports', (select jsonb_agg(object_path) from public.deployment_reports where deployment_id = any(deployment_ids)),
    'private-documents', (select jsonb_agg(path) from (
      select object_path as path from public.leave_request_attachments where request_id = any(leave_ids)
      union all
      select document.object_path from public.profile_change_request_documents document
      join public.profile_change_requests request on request.id = document.request_id
      where request.employee_id = any(employee_ids)
    ) documents)
  )) into storage_paths;

  select coalesce(jsonb_agg(to_jsonb(employee)), '[]') into removed_employees from public.employees employee where employee.id = any(employee_ids);

  -- Applicant data. A hire links the application to a personnel record; both go.
  delete from public.employee_activation_requests where application_id = any(application_ids) or employee_id = any(employee_ids);
  delete from public.applications where id = any(application_ids);
  delete from public.applicant_profile_documents where applicant_id = any(applicant_ids);
  delete from public.applicants where id = any(applicant_ids);

  -- Personnel data, children first: these tables keep official history and so refuse orphaned deletes.
  update public.applications set hired_employee_id = null where hired_employee_id = any(employee_ids);
  delete from public.employee_record_history where employee_id = any(employee_ids);
  delete from public.leave_request_attachments where request_id = any(leave_ids);
  delete from public.leave_request_history where request_id = any(leave_ids);
  delete from public.leave_requests where id = any(leave_ids);
  delete from public.deployment_history where deployment_id = any(deployment_ids);
  delete from public.deployments where id = any(deployment_ids);
  delete from public.employee_promotion_eligibility_summaries where employee_id = any(employee_ids) or evaluation_id = any(evaluation_ids);
  delete from public.promotion_evaluation_evidence evidence
  where evidence.evaluation_id = any(evaluation_ids)
     or evidence.qualification_id in (select id from public.qualifications where employee_id = any(employee_ids))
     or evidence.certification_id in (select id from public.certifications where employee_id = any(employee_ids))
     or evidence.training_record_id in (select id from public.training_records where employee_id = any(employee_ids));
  delete from public.promotion_evaluations where id = any(evaluation_ids);
  delete from public.performance_ratings where employee_id = any(employee_ids);
  delete from public.employee_promotion_dockets where employee_id = any(employee_ids);
  delete from public.attendance_unmatched_events where resolved_log_id = any(attendance_ids);
  delete from public.attendance_logs where id = any(attendance_ids);
  delete from public.attendance_identity_mappings where employee_id = any(employee_ids);
  delete from public.profile_change_requests where employee_id = any(employee_ids);
  -- Service history, qualifications, certifications, training and face enrolments cascade.
  delete from public.employees where id = any(employee_ids);

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  select (select auth.uid()), 'employees', employee ->> 'id', 'delete', employee || jsonb_build_object('user_id', target_user_id)
  from jsonb_array_elements(removed_employees) employee;

  return jsonb_build_object('removes', impact -> 'removes', 'storage', storage_paths);
end;
$$;

create function public.remove_managed_account_data(target_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.remove_managed_account_data(target_user_id);
$$;

revoke all on function private.remove_managed_account_data(uuid) from public, anon, authenticated, service_role;
revoke all on function public.remove_managed_account_data(uuid) from public, anon, authenticated, service_role;
grant execute on function public.remove_managed_account_data(uuid) to authenticated;

-- The edge function now calls remove_managed_account_data, which also covers applicants.
drop function public.remove_applicant_account_data(uuid);
