create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  employee_number text not null unique
    check (
      employee_number = upper(btrim(employee_number))
      and char_length(employee_number) between 3 and 32
    ),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  middle_name text check (middle_name is null or char_length(btrim(middle_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  personal_email text not null
    check (personal_email = lower(btrim(personal_email)) and position('@' in personal_email) > 1),
  phone text check (phone is null or char_length(btrim(phone)) between 3 and 32),
  address text check (address is null or char_length(btrim(address)) between 3 and 500),
  emergency_contact_name text check (emergency_contact_name is null or char_length(btrim(emergency_contact_name)) between 2 and 160),
  emergency_contact_phone text check (emergency_contact_phone is null or char_length(btrim(emergency_contact_phone)) between 3 and 32),
  department_id bigint references public.departments (id) on delete set null,
  position_id bigint references public.positions (id) on delete set null,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'on_leave', 'inactive', 'separated')),
  employment_started_on date not null,
  employment_ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (employment_ended_on is null or employment_ended_on >= employment_started_on)
);

create table public.service_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  department_id bigint references public.departments (id) on delete set null,
  position_id bigint references public.positions (id) on delete set null,
  employment_title text check (employment_title is null or char_length(btrim(employment_title)) between 1 and 160),
  started_on date not null,
  ended_on date,
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  institution text not null check (char_length(btrim(institution)) between 2 and 160),
  qualification_level text check (qualification_level is null or char_length(btrim(qualification_level)) between 1 and 80),
  field_of_study text check (field_of_study is null or char_length(btrim(field_of_study)) between 1 and 160),
  awarded_on date not null,
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  issuer text not null check (char_length(btrim(issuer)) between 2 and 160),
  credential_id text check (credential_id is null or char_length(btrim(credential_id)) between 1 and 160),
  issued_on date not null,
  expires_on date,
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= issued_on)
);

create table public.training_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  course_name text not null check (char_length(btrim(course_name)) between 2 and 160),
  provider text not null check (char_length(btrim(provider)) between 2 and 160),
  completed_on date not null,
  expires_on date,
  hours numeric(6, 2) check (hours is null or hours >= 0),
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= completed_on)
);

create table public.employee_record_history (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.employees (id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete set null,
  record_type text not null check (record_type in ('employees', 'service_history', 'qualifications', 'certifications', 'training_records')),
  action text not null check (action in ('insert', 'update', 'delete')),
  previous_data jsonb not null default '{}'::jsonb,
  next_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index employees_hr_directory_idx
  on public.employees (employment_status, department_id, position_id, employee_number);
create index employees_name_search_idx
  on public.employees (last_name, first_name, employee_number);
create index service_history_employee_started_idx
  on public.service_history (employee_id, started_on desc);
create index qualifications_employee_awarded_idx
  on public.qualifications (employee_id, awarded_on desc);
create index certifications_employee_issued_idx
  on public.certifications (employee_id, issued_on desc);
create index training_records_employee_completed_idx
  on public.training_records (employee_id, completed_on desc);
create index employee_record_history_employee_created_idx
  on public.employee_record_history (employee_id, created_at desc);

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

create trigger employees_touch_updated_at
  before update on public.employees
  for each row execute procedure private.touch_updated_at();
create trigger service_history_touch_updated_at
  before update on public.service_history
  for each row execute procedure private.touch_updated_at();
create trigger qualifications_touch_updated_at
  before update on public.qualifications
  for each row execute procedure private.touch_updated_at();
create trigger certifications_touch_updated_at
  before update on public.certifications
  for each row execute procedure private.touch_updated_at();
create trigger training_records_touch_updated_at
  before update on public.training_records
  for each row execute procedure private.touch_updated_at();

create trigger employees_write_record_history
  after insert or update or delete on public.employees
  for each row execute procedure private.write_employee_record_history();
create trigger service_history_write_record_history
  after insert or update or delete on public.service_history
  for each row execute procedure private.write_employee_record_history();
create trigger qualifications_write_record_history
  after insert or update or delete on public.qualifications
  for each row execute procedure private.write_employee_record_history();
create trigger certifications_write_record_history
  after insert or update or delete on public.certifications
  for each row execute procedure private.write_employee_record_history();
create trigger training_records_write_record_history
  after insert or update or delete on public.training_records
  for each row execute procedure private.write_employee_record_history();

alter table public.employees enable row level security;
alter table public.service_history enable row level security;
alter table public.qualifications enable row level security;
alter table public.certifications enable row level security;
alter table public.training_records enable row level security;
alter table public.employee_record_history enable row level security;

grant select, insert, update on public.employees to authenticated;
grant select, insert, update, delete on public.service_history to authenticated;
grant select, insert, update, delete on public.qualifications to authenticated;
grant select, insert, update, delete on public.certifications to authenticated;
grant select, insert, update, delete on public.training_records to authenticated;
grant select on public.employee_record_history to authenticated;

create policy employees_select_hr_or_own
  on public.employees for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or profile_id = (select auth.uid())
  );
create policy employees_insert_hr
  on public.employees for insert to authenticated
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy employees_update_hr
  on public.employees for update to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create policy service_history_select_hr_or_own
  on public.service_history for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or exists (
      select 1 from public.employees
      where employees.id = service_history.employee_id
        and employees.profile_id = (select auth.uid())
    )
  );
create policy service_history_insert_hr
  on public.service_history for insert to authenticated
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy service_history_update_hr
  on public.service_history for update to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy service_history_delete_hr
  on public.service_history for delete to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create policy qualifications_select_hr_or_own
  on public.qualifications for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or exists (
      select 1 from public.employees
      where employees.id = qualifications.employee_id
        and employees.profile_id = (select auth.uid())
    )
  );
create policy qualifications_insert_hr
  on public.qualifications for insert to authenticated
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy qualifications_update_hr
  on public.qualifications for update to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy qualifications_delete_hr
  on public.qualifications for delete to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create policy certifications_select_hr_or_own
  on public.certifications for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or exists (
      select 1 from public.employees
      where employees.id = certifications.employee_id
        and employees.profile_id = (select auth.uid())
    )
  );
create policy certifications_insert_hr
  on public.certifications for insert to authenticated
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy certifications_update_hr
  on public.certifications for update to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy certifications_delete_hr
  on public.certifications for delete to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create policy training_records_select_hr_or_own
  on public.training_records for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or exists (
      select 1 from public.employees
      where employees.id = training_records.employee_id
        and employees.profile_id = (select auth.uid())
    )
  );
create policy training_records_insert_hr
  on public.training_records for insert to authenticated
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy training_records_update_hr
  on public.training_records for update to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy training_records_delete_hr
  on public.training_records for delete to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create policy employee_record_history_select_hr
  on public.employee_record_history for select to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));
