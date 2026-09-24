-- Safe, explicit deletion for configuration and personal records.
--
-- Design rules:
--   * Only records whose loss does not erase business history may be deleted.
--     Employees, applications, deployments, leave requests, profile-change
--     requests, attendance data, and every *_history / audit table keep their
--     existing status-based lifecycle (deactivate, withdraw, cancel, reject).
--   * A record may only be deleted when nothing else references it. The check
--     is driven by the catalog so future foreign keys are covered
--     automatically, and it also treats ON DELETE SET NULL references as
--     blockers for master data so historic rows are never silently orphaned.
--   * Every delete is authorised inside the database, audited, and explains
--     why it is blocked together with the non-destructive alternative.

-- ---------------------------------------------------------------------------
-- Reference inspection helpers
-- ---------------------------------------------------------------------------

create or replace function private.reference_label(referencing_table text, referencing_column text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case referencing_table
    when 'positions' then 'positions'
    when 'employees' then case when referencing_column = 'profile_id' then 'linked personnel record' else 'personnel records' end
    when 'service_history' then 'service history entries'
    when 'job_openings' then 'job openings'
    when 'applications' then 'job applications'
    when 'promotion_criteria' then 'promotion criteria'
    when 'promotion_criteria_requirements' then 'promotion criteria requirements'
    when 'promotion_evaluations' then 'promotion evaluations'
    when 'promotion_evaluation_evidence' then 'promotion evaluation evidence'
    when 'employee_promotion_eligibility_summaries' then 'promotion eligibility summaries'
    when 'performance_ratings' then 'performance ratings'
    when 'leave_types' then 'leave types'
    when 'leave_requests' then 'leave requests'
    when 'leave_request_attachments' then 'leave attachments'
    when 'leave_request_history' then 'leave decisions'
    when 'deployments' then 'deployments'
    when 'deployment_history' then 'deployment history entries'
    when 'profile_change_requests' then 'profile change requests'
    when 'profile_change_request_documents' then 'profile change documents'
    when 'applicant_documents' then 'application documents'
    when 'applicant_profile_documents' then 'applicant profile documents'
    when 'application_ai_scores' then 'AI screening results'
    when 'employee_activation_requests' then 'employee activation requests'
    when 'attendance_integration_settings' then 'attendance integration settings'
    when 'attendance_identity_mappings' then 'attendance identity mappings'
    when 'attendance_imports' then 'attendance imports'
    when 'attendance_logs' then 'attendance logs'
    when 'attendance_unmatched_events' then 'unmatched attendance events'
    else replace(referencing_table, '_', ' ')
  end;
$$;

-- Counts rows that reference target_table.<pk> = target_id through single
-- column foreign keys. CASCADE references are ignored (they are owned child
-- rows); SET NULL references are included only when requested.
create or replace function private.reference_counts(
  target_table regclass,
  target_id text,
  include_set_null boolean,
  excluded_tables text[] default '{}'
)
returns table (referencing_table text, referencing_column text, label text, row_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reference record;
  counted bigint;
begin
  for reference in
    select
      source_class.relname::text as table_name,
      source_namespace.nspname::text as schema_name,
      source_attribute.attname::text as column_name
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class source_class on source_class.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace source_namespace on source_namespace.oid = source_class.relnamespace
    join pg_catalog.pg_attribute source_attribute
      on source_attribute.attrelid = constraint_row.conrelid
     and source_attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = target_table
      and array_length(constraint_row.conkey, 1) = 1
      and constraint_row.confdeltype <> 'c'
      and (include_set_null or constraint_row.confdeltype not in ('n', 'd'))
      and source_namespace.nspname = 'public'
      and source_class.relname <> 'audit_logs'
      and not (source_class.relname = any (excluded_tables))
  loop
    execute format('select count(*) from %I.%I where %I::text = $1', reference.schema_name, reference.table_name, reference.column_name)
      into counted
      using target_id;
    if counted > 0 then
      referencing_table := reference.table_name;
      referencing_column := reference.column_name;
      label := private.reference_label(reference.table_name, reference.column_name);
      row_count := counted;
      return next;
    end if;
  end loop;
end;
$$;

create or replace function private.require_active_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (
    select 1 from public.user_roles user_role
    join public.profiles profile on profile.id = user_role.user_id
    where user_role.user_id = caller_id
      and user_role.role = 'system_administrator'::public.app_role
      and profile.is_active
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  return caller_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Impact assessment (shared by the preview RPC and every delete RPC)
-- ---------------------------------------------------------------------------

create or replace function private.deletion_impact(entity_type text, entity_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  record_label text;
  blockers jsonb := '[]'::jsonb;
  removes jsonb := '[]'::jsonb;
  reasons text[] := '{}';
  alternative text;
  target_uuid uuid;
  target_bigint bigint;
  position_row public.positions%rowtype;
  target_role public.app_role;
  target_active boolean;
  job_status text;
  requirement_count bigint;
begin
  case entity_type
    when 'department' then
      caller_id := private.require_active_admin();
      target_bigint := entity_id::bigint;
      select name into record_label from public.departments where id = target_bigint;
      if record_label is null then raise exception 'Department was not found.' using errcode = 'P0001'; end if;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.departments'::regclass, entity_id, true) refs;
      alternative := 'Deactivate the department to hide it from new records while keeping history intact.';

    when 'position' then
      caller_id := private.require_active_admin();
      target_bigint := entity_id::bigint;
      select * into position_row from public.positions where id = target_bigint;
      if position_row.id is null then raise exception 'Position was not found.' using errcode = 'P0001'; end if;
      record_label := position_row.title;
      select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
        into blockers from private.reference_counts('public.positions'::regclass, entity_id, true) refs;
      if position_row.is_active
        and lower(position_row.title) in ('patrolman', 'patrolwoman', 'patrolman / patrolwoman', 'patrolman / patrolwoman (pat)')
        and not exists (
          select 1 from public.positions other
          where other.id <> position_row.id and other.is_active
            and lower(other.title) in ('patrolman', 'patrolwoman', 'patrolman / patrolwoman', 'patrolman / patrolwoman (pat)')
        ) then
        reasons := array_append(reasons, 'Hiring requires at least one active Patrolman or Patrolwoman position.'::text);
      end if;
      alternative := 'Deactivate the position to stop using it for new records while keeping history intact.';

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
      select position.title into record_label
      from public.promotion_criteria criterion
      join public.positions position on position.id = criterion.target_position_id
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
$$;

create or replace function private.assert_deletable(entity_type text, entity_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  impact jsonb := private.deletion_impact(entity_type, entity_id);
  summary text;
begin
  if not (impact ->> 'canDelete')::boolean then
    select string_agg(format('%s %s', item ->> 'count', item ->> 'label'), ', ')
      into summary from jsonb_array_elements(impact -> 'blockers') item;
    raise exception '%', concat_ws(' ',
      (impact ->> 'label') || ' cannot be deleted.',
      case when summary is not null then 'It is still used by ' || summary || '.' end,
      (select string_agg(reason, ' ') from jsonb_array_elements_text(impact -> 'reasons') reason),
      impact ->> 'alternative'
    ) using errcode = 'P0001';
  end if;
  return impact;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_deletion_impact(entity_type text, entity_id text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.deletion_impact(entity_type, entity_id);
$$;

create or replace function public.delete_department(target_department_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  lock table public.departments, public.positions, public.employees, public.service_history, public.job_openings in share row exclusive mode;
  perform private.assert_deletable('department', target_department_id::text);
  -- The departments audit trigger records the deleted row and the actor.
  delete from public.departments where id = target_department_id;
end;
$$;

create or replace function public.delete_position(target_position_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  lock table public.positions, public.employees, public.service_history, public.job_openings, public.promotion_criteria in share row exclusive mode;
  perform private.assert_deletable('position', target_position_id::text);
  -- The positions audit trigger records the deleted row and the actor.
  delete from public.positions where id = target_position_id;
end;
$$;

create or replace function public.delete_leave_type(target_leave_type_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_row public.leave_types%rowtype;
begin
  lock table public.leave_types, public.leave_requests in share row exclusive mode;
  perform private.assert_deletable('leave_type', target_leave_type_id::text);
  delete from public.leave_types where id = target_leave_type_id returning * into deleted_row;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'leave_types', deleted_row.id::text, 'delete', to_jsonb(deleted_row));
end;
$$;

create or replace function public.delete_promotion_criterion(target_criterion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_row public.promotion_criteria%rowtype;
  deleted_requirements jsonb;
begin
  lock table public.promotion_criteria, public.promotion_criteria_requirements, public.promotion_evaluations in share row exclusive mode;
  perform private.assert_deletable('promotion_criterion', target_criterion_id::text);
  select coalesce(jsonb_agg(to_jsonb(requirement) order by requirement.ordinal), '[]')
    into deleted_requirements
  from public.promotion_criteria_requirements requirement where requirement.criterion_id = target_criterion_id;
  delete from public.promotion_criteria_requirements where criterion_id = target_criterion_id;
  delete from public.promotion_criteria where id = target_criterion_id returning * into deleted_row;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'promotion_criteria', deleted_row.id::text, 'delete',
    to_jsonb(deleted_row) || jsonb_build_object('requirements', deleted_requirements));
end;
$$;

create or replace function public.delete_notification(target_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_deletable('notification', target_notification_id::text);
  delete from public.notifications
  where id = target_notification_id and recipient_user_id = (select auth.uid());
end;
$$;

-- Drafts were already deletable; this adds the active-HR check, the shared
-- dependency explanation, and an audit record of what was removed.
create or replace function public.delete_draft_job_opening(target_job_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_row public.job_openings%rowtype;
  deleted_criteria jsonb;
begin
  perform 1 from public.job_openings where id = target_job_id for update;
  perform private.assert_deletable('job_opening', target_job_id::text);
  select coalesce(jsonb_agg(to_jsonb(criterion)), '[]') into deleted_criteria
  from public.job_qualification_criteria criterion where criterion.job_opening_id = target_job_id;
  delete from public.job_openings where id = target_job_id returning * into deleted_row;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'job_openings', deleted_row.id::text, 'delete',
    to_jsonb(deleted_row) || jsonb_build_object('criteria', deleted_criteria));
end;
$$;

-- Called by the delete-managed-user Edge Function with the administrator's
-- JWT before it removes the auth user, so authorisation and dependency rules
-- live in the database. Foreign keys still block the delete if a dependent
-- record appears between this check and the auth deletion.
create or replace function public.assert_managed_user_deletable(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  lock table public.user_roles, public.profiles in share row exclusive mode;
  return private.assert_deletable('managed_user', target_user_id::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bug fix: resubmitting a "Needs Revision" application lost its new files.
-- The replace_revision_application_documents trigger deletes an application's
-- documents when it moves from Needs Revision to Under Review. The RPC used to
-- insert the new documents first and change the status afterwards, so the
-- trigger deleted the freshly uploaded files too. Change the status first.
-- ---------------------------------------------------------------------------

create or replace function public.resubmit_application(target_application_id uuid, submitted_documents jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  document jsonb;
  expected_prefix text;
  has_cv boolean := false;
begin
  if caller_id is null then raise exception 'Authenticated applicant access is required.' using errcode = '42501'; end if;
  select application.* into application_row
  from public.applications application join public.applicants applicant on applicant.id = application.applicant_id
  where application.id = target_application_id and applicant.profile_id = caller_id for update of application;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status <> 'Needs Revision' then raise exception 'Only applications marked Needs Revision can be resubmitted.' using errcode = '22023'; end if;
  if jsonb_typeof(submitted_documents) <> 'array' or jsonb_array_length(submitted_documents) not between 1 and 10 then
    raise exception 'Provide between one and ten application documents.' using errcode = '22023';
  end if;
  expected_prefix := 'applicants/' || caller_id::text || '/' || target_application_id::text || '/';
  for document in select value from jsonb_array_elements(submitted_documents) loop
    if document ->> 'kind' not in ('cv', 'credential')
      or document ->> 'objectPath' !~ ('^' || expected_prefix || '[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g)$')
      or document ->> 'mimeType' not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg')
      or coalesce((document ->> 'sizeBytes')::integer, 0) not between 1 and 10485760
      or nullif(btrim(document ->> 'fileName'), '') is null then raise exception 'Invalid application document.' using errcode = '22023'; end if;
    if document ->> 'kind' = 'cv' then has_cv := true; end if;
    if not exists (select 1 from storage.objects object where object.bucket_id = 'applicant-documents' and object.name = document ->> 'objectPath' and object.owner_id = caller_id::text) then
      raise exception 'Application document was not uploaded by the applicant.' using errcode = '42501';
    end if;
  end loop;
  if not has_cv then raise exception 'Attach a CV before resubmitting.' using errcode = '22023'; end if;
  -- Status first: the revision trigger removes only the superseded documents.
  update public.applications set status = 'Under Review', reviewed_at = coalesce(reviewed_at, now()), updated_at = now() where id = target_application_id;
  for document in select value from jsonb_array_elements(submitted_documents) loop
    insert into public.applicant_documents (application_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (target_application_id, document ->> 'kind', document ->> 'objectPath', btrim(document ->> 'fileName'), document ->> 'mimeType', (document ->> 'sizeBytes')::integer, caller_id);
  end loop;
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, 'Needs Revision', 'Under Review', 'Resubmitted by applicant.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Bug fix: promotion criteria with evaluations could not be deactivated,
-- because update_promotion_criterion always rebuilds the requirement list and
-- refuses when evaluation evidence references it. Deactivation is the correct
-- non-destructive path for exactly those criteria, so give it its own RPC.
-- ---------------------------------------------------------------------------

create or replace function public.set_promotion_criterion_active(target_criterion_id uuid, next_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  criterion_row public.promotion_criteria%rowtype;
begin
  if next_is_active is null then raise exception 'Choose whether the criteria are active.' using errcode = '22023'; end if;
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id for update;
  if criterion_row.id is null then raise exception 'Promotion criteria were not found.' using errcode = 'P0001'; end if;
  if criterion_row.is_active = next_is_active then return; end if;
  update public.promotion_criteria
  set is_active = next_is_active,
      updated_by_user_id = caller_id,
      updated_at = greatest(clock_timestamp(), criterion_row.updated_at + interval '1 microsecond')
  where id = criterion_row.id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'promotion_criteria', criterion_row.id::text, case when next_is_active then 'activated' else 'deactivated' end,
    jsonb_build_object('target_position_id', criterion_row.target_position_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Bug fix: HR could not save any personnel record edit. Migration
-- 20260906164059 added the demographic columns below to public.employees after
-- 20260903034246 had switched the table to column-level UPDATE grants, so the
-- HR edit form (which sends these fields) failed with "permission denied for
-- table employees". Row access is unchanged: employees_update_hr still limits
-- updates to HR personnel.
-- ---------------------------------------------------------------------------

grant update (qualifier, place_of_birth, date_of_birth, sex, civil_status, religion)
  on public.employees to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: private helpers are never callable by API roles.
-- ---------------------------------------------------------------------------

revoke all on function private.reference_label(text, text) from public, anon, authenticated;
revoke all on function private.reference_counts(regclass, text, boolean, text[]) from public, anon, authenticated;
revoke all on function private.require_active_admin() from public, anon, authenticated;
revoke all on function private.deletion_impact(text, text) from public, anon, authenticated;
revoke all on function private.assert_deletable(text, text) from public, anon, authenticated;

revoke all on function
  public.get_deletion_impact(text, text),
  public.delete_department(bigint),
  public.delete_position(bigint),
  public.delete_leave_type(uuid),
  public.delete_promotion_criterion(uuid),
  public.delete_notification(uuid),
  public.delete_draft_job_opening(bigint),
  public.assert_managed_user_deletable(uuid),
  public.set_promotion_criterion_active(uuid, boolean),
  public.resubmit_application(uuid, jsonb)
from public, anon;

grant execute on function
  public.get_deletion_impact(text, text),
  public.delete_department(bigint),
  public.delete_position(bigint),
  public.delete_leave_type(uuid),
  public.delete_promotion_criterion(uuid),
  public.delete_notification(uuid),
  public.delete_draft_job_opening(bigint),
  public.assert_managed_user_deletable(uuid),
  public.set_promotion_criterion_active(uuid, boolean),
  public.resubmit_application(uuid, jsonb)
to authenticated;
