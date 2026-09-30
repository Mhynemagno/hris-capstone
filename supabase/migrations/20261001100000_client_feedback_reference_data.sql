-- Client feedback (Doc2, October 2026).
--
-- 1. Ranks: the abbreviations are written in capitals, the "g" is dropped from PSMSg, PCMSg and
--    PEMSg, and PCapt becomes PCPT. Functions that look ranks up by code (hiring places the
--    applicant in 'Pat') are updated to the new code.
-- 2. Unit / Section (formerly Department): the dropdown offers the seven sections of the station.
--    Existing sections are renamed in place so personnel keep their assignment; any other
--    department is deactivated (hidden from new records, kept on history).
-- 3. Unit / Station: the seven sub-stations are added.
-- 4. Eligibility (formerly Qualifications) no longer records an institution, and Certification /
--    Training no longer records an issuer, so both columns become optional.
-- 5. Employees are notified when HR assigns or changes one of their deployments.
-- 6. Accounts can be deleted even when they created or decided records: those references are set
--    to null (the audit log keeps who did what) and a linked personnel record is kept but unlinked.

-- 1. Ranks ---------------------------------------------------------------------------------------
update public.ranks set code = mapping.new_code
from (values
  ('Pat', 'PAT'), ('PCpl', 'PCPL'), ('PSSg', 'PSSG'), ('PMSg', 'PMSG'),
  ('PSMSg', 'PSMS'), ('PCMSg', 'PCMS'), ('PEMSg', 'PEMS'),
  ('PLt', 'PLT'), ('PCapt', 'PCPT')
) as mapping(old_code, new_code)
where public.ranks.code = mapping.old_code;

update public.ranks set code = upper(code) where code <> upper(code);

do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f' and p.prosrc like '%code = ''Pat''%'
  loop
    definition := replace(pg_catalog.pg_get_functiondef(fn.oid), 'code = ''Pat''', 'code = ''PAT''');
    execute definition;
  end loop;
end;
$$;

-- 2. Unit / Section ------------------------------------------------------------------------------
update public.departments set name = mapping.new_name
from (values
  ('Station Administrative and Resource Management Section', 'Administrative and Resource Management Section (SARMS)'),
  ('Station Investigation and Detective Management Section', 'Investigation and Detective Management Section (SIDMS)'),
  ('Traffic and Investigation Unit', 'Traffic and Investigation Section'),
  ('Women and Children Protection Desk', 'Women and Children Protection Desk (WCPD)')
) as mapping(old_name, new_name)
where public.departments.name = mapping.old_name
  and not exists (select 1 from public.departments existing where existing.name = mapping.new_name);

insert into public.departments (name, is_active)
values
  ('Office of the Chief of Police', true),
  ('Deputy Chief of Police for Administration', true),
  ('Deputy Chief of Police for Operations', true),
  ('Administrative and Resource Management Section (SARMS)', true),
  ('Investigation and Detective Management Section (SIDMS)', true),
  ('Traffic and Investigation Section', true),
  ('Women and Children Protection Desk (WCPD)', true)
on conflict (name) do update set is_active = true;

update public.departments set is_active = false
where is_active and name not in (
  'Office of the Chief of Police',
  'Deputy Chief of Police for Administration',
  'Deputy Chief of Police for Operations',
  'Administrative and Resource Management Section (SARMS)',
  'Investigation and Detective Management Section (SIDMS)',
  'Traffic and Investigation Section',
  'Women and Children Protection Desk (WCPD)'
);

-- 3. Unit / Station ------------------------------------------------------------------------------
insert into public.unit_stations (name, is_active)
values
  ('Sub-Station 1 – Greenhills', true),
  ('Sub-Station 2 – Addition Hills', true),
  ('Sub-Station 3 – Kabayanan', true),
  ('Sub-Station 4 – Pasadena', true),
  ('Sub-Station 5 – Balong Bato', true),
  ('Sub-Station 6 – West Crame', true),
  ('Sub-Station 7 – San Perfecto', true)
on conflict (name) do update set is_active = true;

-- 4. Eligibility and Certification / Training ----------------------------------------------------
alter table public.qualifications alter column institution drop not null;
alter table public.certifications alter column issuer drop not null;

-- 5. Deployment notifications --------------------------------------------------------------------
create or replace function private.notify_deployment_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if tg_op = 'UPDATE'
    and new.location is not distinct from old.location
    and new.starts_on is not distinct from old.starts_on
    and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status <> 'active' then return new; end if;

  select employee.profile_id into recipient from public.employees employee where employee.id = new.employee_id;
  if recipient is null then return new; end if;

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    recipient,
    case when tg_op = 'INSERT' then 'deployment_assigned' else 'deployment_updated' end,
    case when tg_op = 'INSERT' then 'New deployment assigned' else 'Deployment updated' end,
    format('You are deployed to %s starting %s.',
      coalesce(nullif(btrim(new.location), ''), nullif(btrim(new.unit), ''), 'a new assignment'),
      to_char(new.starts_on, 'FMMonth FMDD, YYYY')),
    '/employee/deployments'
  );
  return new;
end;
$$;

revoke all on function private.notify_deployment_assignment() from public, anon, authenticated;

drop trigger if exists deployments_notify_employee on public.deployments;
create trigger deployments_notify_employee
after insert or update on public.deployments
for each row execute function private.notify_deployment_assignment();

-- 6. Account deletion ----------------------------------------------------------------------------
-- A decision keeps its date and note after the deciding account is deleted, so the decider may be null.
alter table public.leave_requests drop constraint leave_requests_check1;
alter table public.leave_requests add constraint leave_requests_check1 check (
  (status in ('pending', 'cancelled') and decided_by_user_id is null and decided_at is null and decision_note is null)
  or (status = 'approved' and decided_at is not null)
  or (status = 'rejected' and decided_at is not null and decision_note is not null)
);
alter table public.profile_change_requests drop constraint profile_change_requests_check;
alter table public.profile_change_requests add constraint profile_change_requests_check check (
  (status in ('approved', 'rejected')) = (decided_at is not null)
);

-- Every reference from a public table to an account (auth.users or public.profiles) that used to
-- block the delete now clears itself instead.
do $$
declare
  reference record;
begin
  for reference in
    select
      constraint_row.conname,
      source_class.relname as table_name,
      source_attribute.attname as column_name,
      target_namespace.nspname as target_schema,
      target_class.relname as target_table,
      target_attribute.attname as target_column
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class source_class on source_class.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace source_namespace on source_namespace.oid = source_class.relnamespace
    join pg_catalog.pg_attribute source_attribute
      on source_attribute.attrelid = constraint_row.conrelid and source_attribute.attnum = constraint_row.conkey[1]
    join pg_catalog.pg_class target_class on target_class.oid = constraint_row.confrelid
    join pg_catalog.pg_namespace target_namespace on target_namespace.oid = target_class.relnamespace
    join pg_catalog.pg_attribute target_attribute
      on target_attribute.attrelid = constraint_row.confrelid and target_attribute.attnum = constraint_row.confkey[1]
    where constraint_row.contype = 'f'
      and array_length(constraint_row.conkey, 1) = 1
      and source_namespace.nspname = 'public'
      and constraint_row.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      and constraint_row.confdeltype in ('a', 'r')
  loop
    execute format('alter table public.%I alter column %I drop not null', reference.table_name, reference.column_name);
    execute format('alter table public.%I drop constraint %I', reference.table_name, reference.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references %I.%I (%I) on delete set null',
      reference.table_name, reference.conname, reference.column_name,
      reference.target_schema, reference.target_table, reference.target_column
    );
  end loop;
end;
$$;

-- A linked personnel record no longer blocks deleting the account: employees.profile_id is
-- ON DELETE SET NULL, so the record stays and is simply unlinked.
do $$
declare
  definition text;
  updated text;
begin
  definition := pg_catalog.pg_get_functiondef('private.deletion_impact(text, text)'::regprocedure);
  updated := regexp_replace(
    definition,
    '\s*union all\s+select ''linked personnel record'', count\(\*\) from public\.employees where profile_id = target_uuid having count\(\*\) > 0',
    '',
    'g'
  );
  if updated = definition then
    raise exception 'deletion_impact no longer contains the linked personnel record check.';
  end if;
  execute updated;
end;
$$;

-- Employees request Eligibility changes without an institution, so the request check no longer
-- requires one.
do $$
declare
  definition text;
  updated text;
begin
  definition := pg_catalog.pg_get_functiondef('private.submit_profile_change_request(uuid, text, jsonb, jsonb)'::regprocedure);
  updated := replace(
    definition,
    ' or private.profile_change_qualification_value(item -> ''requestedValue'') ->> ''institution'' is null',
    ''
  );
  if updated = definition then
    raise exception 'submit_profile_change_request no longer contains the institution check.';
  end if;
  execute updated;
end;
$$;
