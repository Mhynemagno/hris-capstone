-- Lets HR delete a personnel record from the employee directory (e.g. one created by mistake).
-- The same server-checked rules as the other deletes apply: official records that reference the
-- employee (attendance, leave, deployments, promotion evaluations, profile change requests, hires)
-- block the delete; personnel entries (service history, qualifications, certifications, training)
-- are removed with it; and a full snapshot is written to the audit log.

-- The history trigger cannot write a row for an employee that no longer exists (its foreign key
-- would fail), so it skips that case; the delete RPC records the snapshot in audit_logs instead.
create or replace function private.write_employee_record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  history_employee_id uuid := (changed_row ->> 'employee_id')::uuid;
begin
  if tg_table_name = 'employees' then
    history_employee_id := (changed_row ->> 'id')::uuid;
  end if;

  if tg_op = 'DELETE' and not exists (select 1 from public.employees where id = history_employee_id) then
    return old;
  end if;

  insert into public.employee_record_history (
    employee_id,
    actor_user_id,
    record_type,
    action,
    previous_data,
    next_data
  )
  values (
    history_employee_id,
    (select auth.uid()),
    tg_table_name,
    lower(tg_op),
    case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end,
    case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.write_employee_record_history()
  from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.deletion_impact(entity_type text, entity_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      -- Records the person created or decided, plus a linked personnel record
      -- and any job applications (reached through their applicant profile).
      with refs as (
        select refs.label, refs.row_count from private.reference_counts('public.profiles'::regclass, entity_id, false) refs
        union all
        select refs.label, refs.row_count from private.reference_counts('auth.users'::regclass, entity_id, false) refs
        union all
        select 'linked personnel record', count(*) from public.employees where profile_id = target_uuid having count(*) > 0
        union all
        select refs.label, refs.row_count
        from public.applicants applicant
        cross join lateral private.reference_counts('public.applicants'::regclass, applicant.id::text, false) refs
        where applicant.profile_id = target_uuid
      )
      select coalesce(jsonb_agg(jsonb_build_object('label', grouped.label, 'count', grouped.total) order by grouped.label), '[]')
        into blockers
      from (select refs.label, sum(refs.row_count)::bigint as total from refs group by refs.label) grouped;
      select coalesce(jsonb_agg(item), '[]') into removes from (
        select jsonb_build_object('label', 'notifications', 'count', count(*)) as item
        from public.notifications where recipient_user_id = target_uuid having count(*) > 0
        union all
        select jsonb_build_object('label', 'applicant profile', 'count', count(*))
        from public.applicants where profile_id = target_uuid having count(*) > 0
      ) removed;
      alternative := 'Deactivate the account to block sign-in while keeping everything the person created or decided.';

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
$function$

revoke all on function private.deletion_impact(text, text) from public, anon, authenticated;

create or replace function public.delete_employee(target_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_row public.employees%rowtype;
  impact jsonb;
  entries jsonb;
begin
  lock table public.employees, public.employee_record_history in share row exclusive mode;
  impact := private.assert_deletable('employee', target_employee_id::text);
  select jsonb_build_object(
    'serviceHistory', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.service_history row_data where row_data.employee_id = target_employee_id), '[]'),
    'qualifications', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.qualifications row_data where row_data.employee_id = target_employee_id), '[]'),
    'certifications', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.certifications row_data where row_data.employee_id = target_employee_id), '[]'),
    'trainingRecords', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.training_records row_data where row_data.employee_id = target_employee_id), '[]')
  ) into entries;
  delete from public.employee_record_history where employee_id = target_employee_id;
  delete from public.employees where id = target_employee_id returning * into deleted_row;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'employees', deleted_row.id::text, 'delete',
    to_jsonb(deleted_row) || jsonb_build_object('entries', entries, 'removed', impact -> 'removes'));
end;
$$;

revoke all on function public.delete_employee(uuid) from public, anon;
grant execute on function public.delete_employee(uuid) to authenticated;
