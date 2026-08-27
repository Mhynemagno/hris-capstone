-- Repairs verified by the branch-wide quality audit.

create or replace function private.submit_leave_request(target_request_id uuid, target_leave_type_id uuid, target_starts_on date, target_ends_on date, request_reason text, requested_attachments jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); target_employee_id uuid; type_row public.leave_types%rowtype; attachment jsonb; attachment_path text;
begin
  if caller_id is null or not (select private.current_user_has_role('employee'::public.app_role)) then raise exception 'Employee access is required.' using errcode = '42501'; end if;
  select id into target_employee_id from public.employees where profile_id = caller_id;
  if target_employee_id is null then raise exception 'Employee record was not found.' using errcode = 'P0001'; end if;
  select * into type_row from public.leave_types where id = target_leave_type_id and is_active for share;
  if not found then raise exception 'Leave type is not active.' using errcode = 'P0001'; end if;
  if target_starts_on < current_date or target_ends_on < target_starts_on then raise exception 'Choose an inclusive current or future leave range.' using errcode = '22007'; end if;
  if request_reason is null or btrim(request_reason) = '' then raise exception 'A leave reason is required.' using errcode = '22023'; end if;
  if jsonb_typeof(requested_attachments) <> 'array' or jsonb_array_length(requested_attachments) > 10 or (type_row.requires_attachment and jsonb_array_length(requested_attachments) = 0) then raise exception 'Supporting evidence is required for this leave type.' using errcode = '22023'; end if;
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    attachment_path := attachment ->> 'objectPath';
    if attachment_path is null or attachment_path !~ ('^leave-requests/' || caller_id::text || '/' || target_request_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$') or attachment ->> 'fileName' !~ '^[^\\/[:cntrl:]]{1,255}$' or attachment ->> 'mimeType' not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') or coalesce((attachment ->> 'sizeBytes')::integer, 0) not between 1 and 10485760 or not exists (select 1 from storage.objects object where object.bucket_id = 'private-documents' and object.name = attachment_path and object.owner_id = caller_id::text) then
      raise exception 'Invalid leave attachment.' using errcode = '22023';
    end if;
  end loop;
  insert into public.leave_requests (id, employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on, reason)
  values (target_request_id, target_employee_id, caller_id, type_row.id, type_row.name, target_starts_on, target_ends_on, btrim(request_reason));
  for attachment in select value from jsonb_array_elements(requested_attachments) loop
    insert into public.leave_request_attachments (request_id, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (target_request_id, attachment ->> 'objectPath', btrim(attachment ->> 'fileName'), attachment ->> 'mimeType', (attachment ->> 'sizeBytes')::integer, caller_id);
  end loop;
  insert into public.leave_request_history (request_id, actor_user_id, event_type) values (target_request_id, caller_id, 'submitted');
end;
$$;

create or replace function private.update_promotion_criterion(target_criterion_id uuid, expected_updated_at timestamptz, target_position_id integer, target_minimum_years integer, target_minimum_rating integer, target_is_active boolean, target_requirements jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := private.require_active_hr(); criterion_row public.promotion_criteria%rowtype; item jsonb; ordinal_value integer := 0; kind_value text; name_value text; label_value text; next_position_id integer := target_position_id;
begin
  select * into criterion_row from public.promotion_criteria where id = target_criterion_id for update;
  if not found then raise exception 'Promotion criteria were not found.' using errcode = 'P0001'; end if;
  if expected_updated_at is null or criterion_row.updated_at <> expected_updated_at then raise exception 'Promotion criteria changed. Refresh and try again.' using errcode = 'P0001'; end if;
  if target_minimum_years not between 0 and 100 or target_minimum_rating is not null and target_minimum_rating not between 1 and 5 or jsonb_typeof(target_requirements) <> 'array' or not exists (select 1 from public.positions where id = next_position_id) then raise exception 'Promotion criteria are invalid.' using errcode = '22023'; end if;
  if exists (select 1 from public.promotion_evaluation_evidence evidence join public.promotion_criteria_requirements requirement on requirement.id = evidence.requirement_id where requirement.criterion_id = criterion_row.id) then raise exception 'Criteria with linked evaluation evidence cannot replace requirements.' using errcode = 'P0001'; end if;
  delete from public.promotion_criteria_requirements where criterion_id = criterion_row.id;
  for item in select value from jsonb_array_elements(target_requirements) loop
    ordinal_value := ordinal_value + 1; kind_value := item ->> 'recordKind'; name_value := btrim(item ->> 'requiredName'); label_value := btrim(item ->> 'label');
    if kind_value not in ('qualification', 'certification', 'training') or name_value is null or name_value = '' or label_value is null or label_value = '' then raise exception 'Promotion requirement is invalid.' using errcode = '22023'; end if;
    insert into public.promotion_criteria_requirements (criterion_id, ordinal, record_kind, required_name, label, is_mandatory) values (criterion_row.id, ordinal_value, kind_value, name_value, label_value, coalesce((item ->> 'isMandatory')::boolean, true));
  end loop;
  update public.promotion_criteria set target_position_id = next_position_id, minimum_years_of_service = target_minimum_years, minimum_performance_rating = target_minimum_rating, is_active = target_is_active, updated_by_user_id = caller_id, updated_at = greatest(clock_timestamp(), criterion_row.updated_at + interval '1 microsecond') where id = criterion_row.id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata) values (caller_id, 'promotion_criteria', criterion_row.id::text, 'updated', '{}'::jsonb);
end;
$$;

-- PGMQ calls the second read argument a visibility timeout. A non-zero value
-- prevents another worker from processing the same in-flight message.
drop function pgmq_public.read(text, integer, integer);
create function pgmq_public.read(
  queue_name text,
  visibility_timeout_seconds integer default 600,
  n integer default 1
)
returns setof pgmq.message_record
language sql
security definer
set search_path = ''
as $$
  select *
  from pgmq.read(queue_name, visibility_timeout_seconds, n, '{}'::jsonb);
$$;
revoke all on function pgmq_public.read(text, integer, integer) from public, anon, authenticated;
grant execute on function pgmq_public.read(text, integer, integer) to service_role;

-- Serialize manual retries per application and enforce the invariant at the
-- index level as a second line of defense against concurrent callers.
create unique index application_ai_scores_one_active_attempt_idx
  on public.application_ai_scores (application_id)
  where status in ('queued', 'processing');

create or replace function private.retry_application_analysis(target_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  latest_attempt public.application_ai_scores;
  retry_score_id uuid;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'Human Resources access is required.' using errcode = '42501';
  end if;

  perform 1 from public.applications where id = target_application_id for update;
  if not found then raise exception 'Application was not found.' using errcode = 'P0001'; end if;

  select * into latest_attempt
  from public.application_ai_scores
  where application_id = target_application_id
  order by created_at desc, id desc
  limit 1;

  if latest_attempt.id is null or latest_attempt.status <> 'failed' then
    raise exception 'Analysis can be retried only after it has failed.' using errcode = 'P0001';
  end if;

  insert into public.application_ai_scores (application_id, requested_by_user_id, status, created_at)
  values (target_application_id, caller_id, 'queued', clock_timestamp())
  returning id into retry_score_id;

  perform pgmq.send('application_analysis', jsonb_build_object('scoreId', retry_score_id));

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'applications', target_application_id::text, 'ai_retry_queued', jsonb_build_object('score_id', retry_score_id, 'previous_score_id', latest_attempt.id));

  return retry_score_id;
end;
$$;

-- Older migrations were created while broad default table grants were active.
-- Revoke those inherited DELETE/UPDATE privileges before restoring the exact
-- operations used by the application; RLS remains the row-level boundary.
revoke all on public.profiles, public.user_roles, public.departments, public.positions, public.audit_logs from anon, authenticated;
grant select on public.profiles to anon;
grant select, update on public.profiles, public.user_roles to authenticated;
grant select, insert, update on public.departments, public.positions to authenticated;
grant select on public.audit_logs to authenticated;

revoke all on public.employees, public.service_history, public.qualifications, public.certifications, public.training_records, public.employee_record_history from anon, authenticated;
grant select, insert, update on public.employees to authenticated;
grant select, insert, update, delete on public.service_history, public.qualifications, public.certifications, public.training_records to authenticated;
grant select on public.employee_record_history to authenticated;
