-- Deleting an applicant account used to fail with "Other records still depend on it: 1 AI
-- screening results, 2 applicant profile documents": the account-deletion check treated the
-- applicant's own recruitment data (which references the account with ON DELETE RESTRICT) as
-- history owned by someone else.
--
-- For APPLICANT accounts the applicant's own recruitment data is now removed with the account:
-- the applicant profile, profile documents, applications and their documents, status history,
-- and AI screening results. The delete-managed-user Edge Function calls
-- remove_applicant_account_data (below) after the dependency check, removes the returned storage
-- objects, and then deletes the auth user. A hired applicant, or anything outside their own
-- recruitment records, still blocks the delete. Other roles keep the full dependency guard.

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

      if target_role = 'applicant'::public.app_role then
        -- An applicant's own recruitment data (applicant profile, profile documents, applications
        -- with their documents, status history, and AI screening results) is removed with the
        -- account. Anything else still blocks: e.g. a hire (personnel record, activation request)
        -- or rows the person wrote on someone else's recruitment records.
        if exists (
          select 1 from public.applications application
          join public.applicants applicant on applicant.id = application.applicant_id
          where applicant.profile_id = target_uuid and application.hired_employee_id is not null
        ) then
          reasons := array_append(reasons, 'This applicant was hired; the hiring record is part of the personnel file.'::text);
        end if;
        with own_applications as (
          select application.id
          from public.applications application
          join public.applicants applicant on applicant.id = application.applicant_id
          where applicant.profile_id = target_uuid
        ), refs as (
          select refs.label, refs.row_count
          from private.reference_counts('public.profiles'::regclass, entity_id, false, array['applicant_profile_documents']) refs
          union all
          select refs.label, refs.row_count
          from private.reference_counts('auth.users'::regclass, entity_id, false, array['applicant_documents', 'application_ai_scores']) refs
          union all
          select 'linked personnel record', count(*) from public.employees where profile_id = target_uuid having count(*) > 0
          union all
          -- References to the applicant profile other than their own applications and documents.
          select refs.label, refs.row_count
          from public.applicants applicant
          cross join lateral private.reference_counts('public.applicants'::regclass, applicant.id::text, false, array['applications']) refs
          where applicant.profile_id = target_uuid
          union all
          -- Records that point at one of their applications (e.g. an employee activation request).
          select refs.label, refs.row_count
          from own_applications
          cross join lateral private.reference_counts('public.applications'::regclass, own_applications.id::text, false) refs
          union all
          -- Rows the person wrote on other people's recruitment records are never removed silently.
          select 'application documents', count(*) from public.applicant_documents document
          where document.uploaded_by_user_id = target_uuid and document.application_id not in (select id from own_applications)
          having count(*) > 0
          union all
          select 'AI screening results', count(*) from public.application_ai_scores score
          where score.requested_by_user_id = target_uuid and score.application_id not in (select id from own_applications)
          having count(*) > 0
          union all
          select 'applicant profile documents', count(*) from public.applicant_profile_documents document
          join public.applicants applicant on applicant.id = document.applicant_id
          where document.uploaded_by_user_id = target_uuid and applicant.profile_id <> target_uuid
          having count(*) > 0
        )
        select coalesce(jsonb_agg(jsonb_build_object('label', grouped.label, 'count', grouped.total) order by grouped.label), '[]')
          into blockers
        from (select refs.label, sum(refs.row_count)::bigint as total from refs group by refs.label) grouped;
        select coalesce(jsonb_agg(item), '[]') into removes from (
          select jsonb_build_object('label', 'applicant profile', 'count', count(*)) as item
          from public.applicants where profile_id = target_uuid having count(*) > 0
          union all
          select jsonb_build_object('label', 'job applications', 'count', count(*))
          from public.applications application join public.applicants applicant on applicant.id = application.applicant_id
          where applicant.profile_id = target_uuid having count(*) > 0
          union all
          select jsonb_build_object('label', 'application documents', 'count', count(*))
          from public.applicant_documents document
          join public.applications application on application.id = document.application_id
          join public.applicants applicant on applicant.id = application.applicant_id
          where applicant.profile_id = target_uuid having count(*) > 0
          union all
          select jsonb_build_object('label', 'applicant profile documents', 'count', count(*))
          from public.applicant_profile_documents document join public.applicants applicant on applicant.id = document.applicant_id
          where applicant.profile_id = target_uuid having count(*) > 0
          union all
          select jsonb_build_object('label', 'AI screening results', 'count', count(*))
          from public.application_ai_scores score
          join public.applications application on application.id = score.application_id
          join public.applicants applicant on applicant.id = application.applicant_id
          where applicant.profile_id = target_uuid having count(*) > 0
          union all
          select jsonb_build_object('label', 'notifications', 'count', count(*))
          from public.notifications where recipient_user_id = target_uuid having count(*) > 0
        ) removed;
      else
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
      end if;
      alternative := 'To keep the account and its history, edit it and clear "Account can sign in" to block sign-in instead.';

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

revoke all on function private.deletion_impact(text, text) from public, anon, authenticated;

-- Removes an applicant's own recruitment data just before their account is deleted, and returns
-- the storage objects the Edge Function must remove ({ "<bucket>": ["<path>", ...] }).
-- For any other role this only re-checks deletability and removes nothing.
create or replace function public.remove_applicant_account_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  impact jsonb;
  applicant_row public.applicants%rowtype;
  storage_paths jsonb;
begin
  lock table public.user_roles, public.profiles in share row exclusive mode;
  impact := private.assert_deletable('managed_user', target_user_id::text);
  if not exists (select 1 from public.user_roles where user_id = target_user_id and role = 'applicant'::public.app_role) then
    return jsonb_build_object('removes', impact -> 'removes', 'storage', '{}'::jsonb);
  end if;

  select * into applicant_row from public.applicants where profile_id = target_user_id for update;
  if applicant_row.id is null then
    return jsonb_build_object('removes', impact -> 'removes', 'storage', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'applicant-documents', coalesce((
      select jsonb_agg(document.object_path)
      from public.applicant_documents document
      join public.applications application on application.id = document.application_id
      where application.applicant_id = applicant_row.id
    ), '[]'::jsonb),
    'applicant-profile-documents', coalesce((
      select jsonb_agg(document.object_path) from public.applicant_profile_documents document where document.applicant_id = applicant_row.id
    ), '[]'::jsonb),
    'applicant-profile-photos', case when applicant_row.profile_image_path is null then '[]'::jsonb else jsonb_build_array(applicant_row.profile_image_path) end
  ) into storage_paths;

  -- Documents, status history, and AI screening results cascade with each application.
  delete from public.applications where applicant_id = applicant_row.id;
  delete from public.applicant_profile_documents where applicant_id = applicant_row.id;
  delete from public.applicants where id = applicant_row.id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), 'applicants', applicant_row.id::text, 'delete',
    jsonb_build_object(
      'full_name', concat_ws(' ', applicant_row.first_name, applicant_row.middle_name, applicant_row.last_name),
      'user_id', target_user_id,
      'removed', impact -> 'removes'
    ));

  return jsonb_build_object('removes', impact -> 'removes', 'storage', storage_paths);
end;
$$;

revoke all on function public.remove_applicant_account_data(uuid) from public, anon;
grant execute on function public.remove_applicant_account_data(uuid) to authenticated;
