-- Employee feedback: a profile-change decision notification now links to that
-- specific request, and changing the account password leaves an in-app notice.

-- 1. Decision notifications open the decided request instead of the list.
CREATE OR REPLACE FUNCTION private.decide_profile_change_request(target_request_id uuid, requested_decision text, requested_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
  insert into public.notifications (recipient_user_id, type, title, body, link) values (request.submitted_by_user_id, 'profile_change_decision', 'Profile change request ' || requested_decision, case when requested_decision = 'approved' then 'Your profile change request was approved.' else 'Your profile change request was rejected.' end, '/employee/profile/change-requests/' || target_request_id::text);
end;
$$;

-- Point earlier decision notifications at their request. The decision and its
-- notification are written in one transaction, so both carry the same now().
update public.notifications notification
set link = '/employee/profile/change-requests/' || request.id::text
from public.profile_change_requests request
where notification.type = 'profile_change_decision'
  and notification.link = '/employee/profile/change-requests'
  and notification.recipient_user_id = request.submitted_by_user_id
  and notification.created_at = request.decided_at;

-- 2. "Password changed" notice for the signed-in user only.
create or replace function public.record_password_changed()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authenticated user required.' using errcode = '42501';
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (current_user_id, 'password_changed', 'Password changed', 'Your account password was changed.', null);
end;
$$;

revoke all on function public.record_password_changed() from public, anon, authenticated;
grant execute on function public.record_password_changed() to authenticated;
