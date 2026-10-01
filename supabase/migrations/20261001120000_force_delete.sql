-- Client feedback: every option and record can be deleted, and a delete that is blocked by other
-- records can be forced.
--
-- * Unit / Section (departments), ranks, units / stations, and the personnel entries (service
--   history, eligibility, certification / training, training) gain the same server-checked
--   delete as the other records: get_deletion_impact previews it and delete_record runs it.
-- * delete_record(..., force => true) also removes what depends on the record. An optional link
--   (a nullable column) is cleared; a required one has its rows removed, recursively. A personnel
--   record is never removed as a side effect: forcing the delete of something a personnel record
--   points at only clears that link.
-- * Account and notification deletes cannot be forced: their remaining rules (your own account,
--   the last active administrator) protect access, not history.
-- * Every forced delete writes the deleted row and what it removed to the audit log.

-- ---------------------------------------------------------------------------
-- Recursive removal of a row and everything that depends on it
-- ---------------------------------------------------------------------------

create or replace function private.force_delete_rows(
  target_table regclass,
  target_column text,
  target_value text,
  depth integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reference record;
  parent_key text;
  counted bigint;
  remaining bigint;
  pass integer;
begin
  if depth > 12 then
    raise exception 'These records are linked too deeply to be force deleted.' using errcode = 'P0001';
  end if;

  -- Removing a child can write new rows that point back at the parent (the personnel-record history
  -- trigger does), so the dependents are swept again until nothing is left.
  for pass in 1..4 loop
    remaining := 0;
    for reference in
      select
        source_namespace.nspname as schema_name,
        source_class.relname as table_name,
        source_class.oid as table_oid,
        source_attribute.attname as column_name,
        source_attribute.attnotnull as not_null,
        target_attribute.attname as target_key,
        constraint_row.confdeltype as on_delete
      from pg_catalog.pg_constraint constraint_row
      join pg_catalog.pg_class source_class on source_class.oid = constraint_row.conrelid
      join pg_catalog.pg_namespace source_namespace on source_namespace.oid = source_class.relnamespace
      join pg_catalog.pg_attribute source_attribute
        on source_attribute.attrelid = constraint_row.conrelid and source_attribute.attnum = constraint_row.conkey[1]
      join pg_catalog.pg_attribute target_attribute
        on target_attribute.attrelid = constraint_row.confrelid and target_attribute.attnum = constraint_row.confkey[1]
      where constraint_row.contype = 'f'
        and constraint_row.confrelid = target_table
        and array_length(constraint_row.conkey, 1) = 1
        -- ON DELETE SET NULL / SET DEFAULT already let the parent go.
        and constraint_row.confdeltype not in ('n', 'd')
        and source_class.relname <> 'audit_logs'
    loop
      execute format(
        'select count(*) from %I.%I child where child.%I in (select parent.%I from %s parent where parent.%I::text = $1)',
        reference.schema_name, reference.table_name, reference.column_name, reference.target_key, target_table, target_column
      ) into counted using target_value;
      continue when counted = 0;
      remaining := remaining + counted;

      -- An optional link is cleared rather than removing the row that holds it. A check constraint
      -- or trigger may refuse that (e.g. promotion evidence must name exactly one credential); the
      -- row is then removed instead, unless it is a personnel record.
      if not reference.not_null and reference.on_delete <> 'c' then
        begin
          execute format(
            'update %I.%I set %I = null where %I in (select parent.%I from %s parent where parent.%I::text = $1)',
            reference.schema_name, reference.table_name, reference.column_name, reference.column_name,
            reference.target_key, target_table, target_column
          ) using target_value;
          continue;
        exception when others then
          if reference.table_oid = 'public.employees'::regclass then raise; end if;
        end;
      end if;

      if reference.table_oid = 'public.employees'::regclass then
        raise exception 'Personnel records still use this. Change them first, then delete it.' using errcode = 'P0001';
      end if;

      for parent_key in execute format(
        'select distinct parent.%I::text from %s parent where parent.%I::text = $1',
        reference.target_key, target_table, target_column
      ) using target_value
      loop
        perform private.force_delete_rows(
          format('%I.%I', reference.schema_name, reference.table_name)::regclass,
          reference.column_name,
          parent_key,
          depth + 1
        );
      end loop;
    end loop;
    exit when remaining = 0;
  end loop;

  execute format('delete from %s where %I::text = $1', target_table, target_column) using target_value;
end;
$$;

revoke all on function private.force_delete_rows(regclass, text, text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Impact preview for the options and personnel entries
-- ---------------------------------------------------------------------------

create or replace function private.entry_deletion_impact(entity_type text, entity_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_label text;
  target_table regclass;
  blockers jsonb := '[]'::jsonb;
  alternative text;
begin
  case entity_type
    when 'department' then
      perform private.require_active_admin();
      target_table := 'public.departments'::regclass;
      select name into record_label from public.departments where id = entity_id::bigint;
      if record_label is null then raise exception 'Unit / section was not found.' using errcode = 'P0001'; end if;
      alternative := 'Deactivate it so it is no longer offered; records that use it keep it.';
    when 'rank' then
      perform private.require_active_admin();
      target_table := 'public.ranks'::regclass;
      select concat_ws(' — ', code, name) into record_label from public.ranks where id = entity_id::bigint;
      if record_label is null then raise exception 'Rank was not found.' using errcode = 'P0001'; end if;
      alternative := 'Deactivate it so it is no longer offered; records that use it keep it.';
    when 'unit_station' then
      perform private.require_active_admin();
      target_table := 'public.unit_stations'::regclass;
      select name into record_label from public.unit_stations where id = entity_id::bigint;
      if record_label is null then raise exception 'Unit / station was not found.' using errcode = 'P0001'; end if;
      alternative := 'Deactivate it so it is no longer offered; records that use it keep it.';
    when 'service_history' then
      perform private.require_active_hr();
      target_table := 'public.service_history'::regclass;
      select 'Service history from ' || to_char(started_on, 'FMMonth FMDD, YYYY') into record_label
      from public.service_history where id = entity_id::uuid;
      if record_label is null then raise exception 'Service history entry was not found.' using errcode = 'P0001'; end if;
    when 'qualification' then
      perform private.require_active_hr();
      target_table := 'public.qualifications'::regclass;
      select name into record_label from public.qualifications where id = entity_id::uuid;
      if record_label is null then raise exception 'Eligibility was not found.' using errcode = 'P0001'; end if;
    when 'certification' then
      perform private.require_active_hr();
      target_table := 'public.certifications'::regclass;
      select name into record_label from public.certifications where id = entity_id::uuid;
      if record_label is null then raise exception 'Certification / training was not found.' using errcode = 'P0001'; end if;
    when 'training_record' then
      perform private.require_active_hr();
      target_table := 'public.training_records'::regclass;
      select course_name into record_label from public.training_records where id = entity_id::uuid;
      if record_label is null then raise exception 'Training record was not found.' using errcode = 'P0001'; end if;
    else
      raise exception 'Deletion is not supported for this record type.' using errcode = '22023';
  end case;

  -- Options are in use when anything points at them, including links that would only be cleared.
  select coalesce(jsonb_agg(jsonb_build_object('label', refs.label, 'count', refs.row_count) order by refs.label), '[]')
    into blockers
  from private.reference_counts(target_table, entity_id, entity_type in ('department', 'rank', 'unit_station')) refs;

  return jsonb_build_object(
    'entityType', entity_type,
    'entityId', entity_id,
    'label', record_label,
    'canDelete', jsonb_array_length(blockers) = 0,
    'blockers', blockers,
    'reasons', '[]'::jsonb,
    'removes', '[]'::jsonb,
    'alternative', alternative
  );
exception
  when invalid_text_representation then
    raise exception 'The record identifier is not valid.' using errcode = '22023';
end;
$$;

revoke all on function private.entry_deletion_impact(text, text) from public, anon, authenticated;

-- The preview now also says whether a blocked delete can be forced.
create or replace function public.get_deletion_impact(entity_type text, entity_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  impact jsonb;
begin
  if entity_type in ('department', 'rank', 'unit_station', 'service_history', 'qualification', 'certification', 'training_record') then
    impact := private.entry_deletion_impact(entity_type, entity_id);
  else
    impact := private.deletion_impact(entity_type, entity_id);
  end if;
  return impact || jsonb_build_object(
    'canForce', not (impact ->> 'canDelete')::boolean and entity_type not in ('managed_user', 'notification')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete (optionally forced)
-- ---------------------------------------------------------------------------

create or replace function public.delete_record(entity_type text, entity_id text, force boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  impact jsonb;
  target_table regclass;
  deleted_row jsonb;
begin
  -- Role and existence checks run inside the preview.
  impact := public.get_deletion_impact(entity_type, entity_id);
  target_table := case entity_type
    when 'department' then 'public.departments'
    when 'rank' then 'public.ranks'
    when 'unit_station' then 'public.unit_stations'
    when 'service_history' then 'public.service_history'
    when 'qualification' then 'public.qualifications'
    when 'certification' then 'public.certifications'
    when 'training_record' then 'public.training_records'
    when 'leave_type' then 'public.leave_types'
    when 'promotion_criterion' then 'public.promotion_criteria'
    when 'job_opening' then 'public.job_openings'
    when 'employee' then 'public.employees'
  end::regclass;
  if target_table is null then
    raise exception 'This record cannot be deleted here.' using errcode = '22023';
  end if;

  if not (impact ->> 'canDelete')::boolean and not (force and (impact ->> 'canForce')::boolean) then
    if entity_type in ('department', 'rank', 'unit_station', 'service_history', 'qualification', 'certification', 'training_record') then
      raise exception '% cannot be deleted. It is still used by %.', impact ->> 'label',
        (select string_agg(format('%s %s', item ->> 'count', item ->> 'label'), ', ') from jsonb_array_elements(impact -> 'blockers') item)
        using errcode = 'P0001';
    end if;
    perform private.assert_deletable(entity_type, entity_id);
  end if;

  execute format('select to_jsonb(row_data) from %s row_data where row_data.id::text = $1', target_table)
    into deleted_row using entity_id;
  perform private.force_delete_rows(target_table, 'id', entity_id);

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values ((select auth.uid()), (select relname from pg_catalog.pg_class where oid = target_table), entity_id, 'delete',
    coalesce(deleted_row, '{}'::jsonb) || jsonb_build_object(
      'forced', force and not (impact ->> 'canDelete')::boolean,
      'blockers', impact -> 'blockers',
      'removed', impact -> 'removes'
    ));
end;
$$;

revoke all on function public.get_deletion_impact(text, text), public.delete_record(text, text, boolean) from public, anon;
grant execute on function public.get_deletion_impact(text, text), public.delete_record(text, text, boolean) to authenticated;
