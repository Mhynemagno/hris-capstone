-- Recruitment form feedback (2026-09-27): HR no longer picks a department or rank for a job posting,
-- and Title, Location and Deadline of Application are required.
--   * job_openings.department_id / rank_id become nullable (existing values are kept).
--   * save_job_opening accepts null department/rank. A value that is passed must still be active;
--     on update a null keeps the posting's saved department/rank instead of clearing it.
--   * save_job_opening now requires a location and a closing date (Deadline of Application).
-- Signature, security definer, search_path and grants are unchanged.

alter table public.job_openings
  alter column department_id drop not null,
  alter column rank_id drop not null;

CREATE OR REPLACE FUNCTION private.save_job_opening(target_job_id bigint, target_department_id bigint, target_rank_id bigint, target_title text, target_description text, target_location text, target_closes_on date, target_status text, requested_criteria jsonb)
 RETURNS job_openings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  job_row public.job_openings%rowtype;
  criterion jsonb;
  criterion_kind text;
  criterion_requirement text;
  criterion_ordinal integer := 0;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'Human Resources access is required.' using errcode = '42501';
  end if;
  if target_title is null or char_length(btrim(target_title)) not between 2 and 160
    or target_description is null or char_length(btrim(target_description)) not between 20 and 10000
    or target_location is null or char_length(btrim(target_location)) not between 2 and 160
    or target_closes_on is null
    or target_status is null or target_status not in ('draft', 'published', 'closed') then
    raise exception 'Job opening details are invalid.' using errcode = '22023';
  end if;
  if target_department_id is not null and not exists (select 1 from public.departments where id = target_department_id and is_active)
    or target_rank_id is not null and not exists (select 1 from public.ranks where id = target_rank_id and is_active) then
    raise exception 'Choose an active department and an active rank.' using errcode = '22023';
  end if;
  if requested_criteria is null or jsonb_typeof(requested_criteria) <> 'array'
    or jsonb_array_length(requested_criteria) not between 1 and 30 then
    raise exception 'Provide between 1 and 30 qualification criteria.' using errcode = '22023';
  end if;
  for criterion in select value from jsonb_array_elements(requested_criteria) loop
    criterion_kind := criterion ->> 'kind';
    criterion_requirement := btrim(criterion ->> 'requirement');
    if criterion_kind not in ('education', 'eligibility', 'experience', 'skill', 'certification', 'other')
      or criterion_requirement is null or char_length(criterion_requirement) not between 2 and 1000
      or criterion ? 'isRequired' and jsonb_typeof(criterion -> 'isRequired') <> 'boolean' then
      raise exception 'Qualification criterion is invalid.' using errcode = '22023';
    end if;
  end loop;
  if target_job_id is null then
    insert into public.job_openings (department_id, rank_id, title, description, location, closes_on, status, published_at, created_by_user_id)
    values (target_department_id, target_rank_id, btrim(target_title), btrim(target_description), nullif(btrim(target_location), ''), target_closes_on, target_status, case when target_status = 'published' then clock_timestamp() else null end, caller_id)
    returning * into job_row;
  else
    select * into job_row from public.job_openings where id = target_job_id for update;
    if not found then raise exception 'Job opening was not found.' using errcode = 'P0001'; end if;
    update public.job_openings
    set department_id = coalesce(target_department_id, job_row.department_id), rank_id = coalesce(target_rank_id, job_row.rank_id), title = btrim(target_title),
        description = btrim(target_description), location = nullif(btrim(target_location), ''), closes_on = target_closes_on,
        status = target_status, published_at = case when target_status = 'published' then coalesce(job_row.published_at, clock_timestamp()) else null end
    where id = target_job_id returning * into job_row;
    delete from public.job_qualification_criteria where job_opening_id = target_job_id;
  end if;
  for criterion in select value from jsonb_array_elements(requested_criteria) loop
    criterion_ordinal := criterion_ordinal + 1;
    insert into public.job_qualification_criteria (job_opening_id, ordinal, kind, requirement, is_required)
    values (job_row.id, criterion_ordinal, criterion ->> 'kind', btrim(criterion ->> 'requirement'), coalesce((criterion ->> 'isRequired')::boolean, true));
  end loop;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'job_openings', job_row.id::text, case when target_job_id is null then 'created' else 'updated' end, jsonb_build_object('status', target_status, 'criteria_count', criterion_ordinal));
  return job_row;
end;
$function$;

revoke all on function private.save_job_opening(bigint, bigint, bigint, text, text, text, date, text, jsonb) from public, anon, authenticated;
