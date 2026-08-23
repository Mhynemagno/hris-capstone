create table public.job_openings (
  id bigint generated always as identity primary key,
  department_id bigint not null references public.departments (id) on delete restrict,
  position_id bigint not null references public.positions (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null check (char_length(btrim(description)) between 20 and 10000),
  location text check (location is null or char_length(btrim(location)) between 2 and 160),
  closes_on date,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  published_at timestamptz,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published') = (published_at is not null))
);

create table public.job_qualification_criteria (
  id uuid primary key default gen_random_uuid(),
  job_opening_id bigint not null references public.job_openings (id) on delete cascade,
  ordinal integer not null check (ordinal between 1 and 30),
  kind text not null check (kind in ('education', 'experience', 'skill', 'certification', 'other')),
  requirement text not null check (char_length(btrim(requirement)) between 2 and 1000),
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (job_opening_id, ordinal)
);

create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  middle_name text check (middle_name is null or char_length(btrim(middle_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  phone text check (phone is null or char_length(btrim(phone)) between 3 and 32),
  address text check (address is null or char_length(btrim(address)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key,
  applicant_id uuid not null references public.applicants (id) on delete restrict,
  job_opening_id bigint not null references public.job_openings (id) on delete restrict,
  status text not null default 'Submitted' check (status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Hired', 'Not Selected')),
  cover_note text check (cover_note is null or char_length(btrim(cover_note)) <= 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  hired_employee_id uuid unique references public.employees (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, job_opening_id)
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  previous_status text check (previous_status is null or previous_status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Hired', 'Not Selected')),
  next_status text not null check (next_status in ('Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Hired', 'Not Selected')),
  note text check (note is null or char_length(btrim(note)) <= 2000),
  created_at timestamptz not null default now()
);

create table public.applicant_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind text not null check (kind in ('cv', 'credential')),
  object_path text not null unique check (char_length(btrim(object_path)) between 1 and 500),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.employee_activation_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  application_id uuid not null unique references public.applications (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'activated')),
  requested_by_user_id uuid not null references auth.users (id) on delete restrict,
  activated_by_user_id uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'activated') = (activated_at is not null))
);

create index job_openings_public_list_idx
  on public.job_openings (closes_on, published_at desc)
  where status = 'published';
create index job_openings_department_id_idx on public.job_openings (department_id);
create index job_openings_position_id_idx on public.job_openings (position_id);
create index job_openings_created_by_user_id_idx on public.job_openings (created_by_user_id);
create index job_qualification_criteria_job_opening_id_idx
  on public.job_qualification_criteria (job_opening_id, ordinal);
create index applicants_profile_id_idx on public.applicants (profile_id);
create index applications_applicant_created_idx on public.applications (applicant_id, created_at desc);
create index applications_hr_queue_idx on public.applications (status, created_at asc);
create index applications_job_opening_id_idx on public.applications (job_opening_id);
create index application_status_history_application_created_idx
  on public.application_status_history (application_id, created_at asc);
create index applicant_documents_application_id_idx
  on public.applicant_documents (application_id, created_at asc);
create index applicant_documents_uploaded_by_user_id_idx
  on public.applicant_documents (uploaded_by_user_id);
create index employee_activation_requests_pending_profile_idx
  on public.employee_activation_requests (profile_id)
  where status = 'pending';
create index employee_activation_requests_requested_by_user_id_idx
  on public.employee_activation_requests (requested_by_user_id);

create trigger job_openings_touch_updated_at
  before update on public.job_openings
  for each row execute procedure private.touch_updated_at();
create trigger applicants_touch_updated_at
  before update on public.applicants
  for each row execute procedure private.touch_updated_at();
create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute procedure private.touch_updated_at();

alter table public.job_openings enable row level security;
alter table public.job_qualification_criteria enable row level security;
alter table public.applicants enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.applicant_documents enable row level security;
alter table public.employee_activation_requests enable row level security;

revoke all on table public.job_openings from anon, authenticated;
grant select on table public.job_openings to anon, authenticated;
grant insert, update on table public.job_openings to authenticated;

create policy job_openings_select_anon_published
  on public.job_openings for select to anon
  using (
    status = 'published'
    and (closes_on is null or closes_on >= current_date)
  );

create policy job_openings_select_authenticated
  on public.job_openings for select to authenticated
  using (
    (status = 'published' and (closes_on is null or closes_on >= current_date))
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );
create policy job_openings_insert_hr
  on public.job_openings for insert to authenticated
  with check (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    and created_by_user_id = (select auth.uid())
  );
create policy job_openings_update_own_hr
  on public.job_openings for update to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    and created_by_user_id = (select auth.uid())
  )
  with check (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    and created_by_user_id = (select auth.uid())
  );

revoke all on table public.job_qualification_criteria from anon, authenticated;
revoke all on table public.applicants from anon, authenticated;
revoke all on table public.applications from anon, authenticated;
revoke all on table public.application_status_history from anon, authenticated;
revoke all on table public.applicant_documents from anon, authenticated;
revoke all on table public.employee_activation_requests from anon, authenticated;

grant select on table public.job_qualification_criteria to anon, authenticated;
grant insert, update, delete on table public.job_qualification_criteria to authenticated;
grant select, insert, update on table public.applicants to authenticated;
grant select on table public.applications, public.application_status_history, public.applicant_documents to authenticated;

create policy job_criteria_select_anon_published
  on public.job_qualification_criteria for select to anon
  using (
    exists (
      select 1
      from public.job_openings opening
      where opening.id = job_opening_id
        and opening.status = 'published'
        and (opening.closes_on is null or opening.closes_on >= current_date)
    )
  );

create policy job_criteria_select_authenticated
  on public.job_qualification_criteria for select to authenticated
  using (
    exists (
      select 1
      from public.job_openings opening
      where opening.id = job_opening_id
        and opening.status = 'published'
        and (opening.closes_on is null or opening.closes_on >= current_date)
    )
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );
create policy job_criteria_insert_hr
  on public.job_qualification_criteria for insert to authenticated
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy job_criteria_update_hr
  on public.job_qualification_criteria for update to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check ((select private.current_user_has_role('hr_personnel'::public.app_role)));
create policy job_criteria_delete_hr
  on public.job_qualification_criteria for delete to authenticated
  using ((select private.current_user_has_role('hr_personnel'::public.app_role)));

create policy applicants_select_own_or_hr
  on public.applicants for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );
create policy applicants_insert_own
  on public.applicants for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy applicants_update_own
  on public.applicants for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy applications_select_own_or_hr
  on public.applications for select to authenticated
  using (
    exists (
      select 1 from public.applicants applicant
      where applicant.id = applicant_id
        and applicant.profile_id = (select auth.uid())
    )
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );
create policy application_history_select_own_or_hr
  on public.application_status_history for select to authenticated
  using (
    exists (
      select 1
      from public.applications application
      join public.applicants applicant on applicant.id = application.applicant_id
      where application.id = application_id
        and applicant.profile_id = (select auth.uid())
    )
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );
create policy applicant_documents_select_own_or_hr
  on public.applicant_documents for select to authenticated
  using (
    exists (
      select 1
      from public.applications application
      join public.applicants applicant on applicant.id = application.applicant_id
      where application.id = application_id
        and applicant.profile_id = (select auth.uid())
    )
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('applicant-documents', 'applicant-documents', false, 10485760)
on conflict (id) do nothing;

create policy applicant_documents_upload_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-documents'
    and (storage.foldername(name))[1] = 'applicants'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 3
  );
create policy applicant_documents_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'applicant-documents'
    and (storage.foldername(name))[1] = 'applicants'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy applicant_documents_read_hr
  on storage.objects for select to authenticated
  using (
    bucket_id = 'applicant-documents'
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create or replace function private.submit_application(
  target_application_id uuid,
  target_job_opening_id bigint,
  submitted_cover_note text,
  submitted_documents jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_applicant_id uuid;
  document jsonb;
  expected_prefix text;
  has_cv boolean := false;
begin
  if caller_id is null then
    raise exception 'Authenticated applicant access is required.' using errcode = '42501';
  end if;

  select applicant.id into target_applicant_id
  from public.applicants applicant
  where applicant.profile_id = caller_id;

  if target_applicant_id is null then
    raise exception 'Complete an applicant profile before applying.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.job_openings opening
    where opening.id = target_job_opening_id
      and opening.status = 'published'
      and (opening.closes_on is null or opening.closes_on >= current_date)
  ) then
    raise exception 'The selected job opening is not accepting applications.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.applications application
    where application.applicant_id = target_applicant_id
      and application.job_opening_id = target_job_opening_id
  ) then
    raise exception 'You have already applied for this opening.' using errcode = '23505';
  end if;

  if jsonb_typeof(submitted_documents) <> 'array'
     or jsonb_array_length(submitted_documents) < 1
     or jsonb_array_length(submitted_documents) > 10 then
    raise exception 'Provide between one and ten application documents.' using errcode = '22023';
  end if;

  expected_prefix := 'applicants/' || caller_id::text || '/' || target_application_id::text || '/';
  for document in select value from jsonb_array_elements(submitted_documents) loop
    if document ->> 'kind' not in ('cv', 'credential')
       or document ->> 'objectPath' !~ ('^' || expected_prefix || '[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g)$')
       or document ->> 'mimeType' not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg')
       or coalesce((document ->> 'sizeBytes')::integer, 0) not between 1 and 10485760
       or nullif(btrim(document ->> 'fileName'), '') is null then
      raise exception 'Invalid application document.' using errcode = '22023';
    end if;
    if document ->> 'kind' = 'cv' then has_cv := true; end if;
    if not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'applicant-documents'
        and object.name = document ->> 'objectPath'
        and object.owner_id = caller_id::text
    ) then
      raise exception 'Application document was not uploaded by the applicant.' using errcode = '42501';
    end if;
  end loop;

  if not has_cv then
    raise exception 'Attach a CV before submitting.' using errcode = '22023';
  end if;

  insert into public.applications (id, applicant_id, job_opening_id, cover_note)
  values (target_application_id, target_applicant_id, target_job_opening_id, nullif(btrim(submitted_cover_note), ''));

  for document in select value from jsonb_array_elements(submitted_documents) loop
    insert into public.applicant_documents (application_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
    values (
      target_application_id,
      document ->> 'kind',
      document ->> 'objectPath',
      btrim(document ->> 'fileName'),
      document ->> 'mimeType',
      (document ->> 'sizeBytes')::integer,
      caller_id
    );
  end loop;

  insert into public.application_status_history (application_id, actor_user_id, next_status, note)
  values (target_application_id, caller_id, 'Submitted', null);

  return target_application_id;
end;
$$;

create or replace function public.submit_application(
  target_application_id uuid,
  target_job_opening_id bigint,
  submitted_cover_note text,
  submitted_documents jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.submit_application(target_application_id, target_job_opening_id, submitted_cover_note, submitted_documents);
end;
$$;

revoke all on function private.submit_application(uuid, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.submit_application(uuid, bigint, text, jsonb) from public, anon;
grant execute on function public.submit_application(uuid, bigint, text, jsonb) to authenticated;

grant select on table public.employee_activation_requests to authenticated;
create policy employee_activation_requests_select_hr_or_admin
  on public.employee_activation_requests for select to authenticated
  using (
    (select private.current_user_has_role('hr_personnel'::public.app_role))
    or (select private.current_user_has_role('system_administrator'::public.app_role))
  );

create or replace function private.transition_application_status(
  target_application_id uuid,
  target_next_status text,
  transition_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  previous_application_status text;
begin
  if caller_id is null or not exists (
    select 1
    from public.user_roles role
    join public.profiles profile on profile.id = role.user_id
    where role.user_id = caller_id
      and role.role = 'hr_personnel'::public.app_role
      and profile.is_active
  ) then
    raise exception 'HR access is required.' using errcode = '42501';
  end if;

  select application.status into previous_application_status
  from public.applications application
  where application.id = target_application_id
  for update;

  if previous_application_status is null then
    raise exception 'Application was not found.' using errcode = 'P0001';
  end if;

  if not (
    (previous_application_status = 'Submitted' and target_next_status = 'Under Review')
    or (previous_application_status = 'Under Review' and target_next_status in ('Shortlisted', 'Interview', 'Not Selected'))
    or (previous_application_status = 'Shortlisted' and target_next_status in ('Interview', 'Not Selected'))
    or (previous_application_status = 'Interview' and target_next_status in ('Shortlisted', 'Not Selected'))
  ) then
    raise exception 'Invalid application status transition.' using errcode = '22023';
  end if;

  update public.applications
  set status = target_next_status,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
  where id = target_application_id;

  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, previous_application_status, target_next_status, nullif(btrim(transition_note), ''));
end;
$$;

create or replace function public.transition_application_status(
  target_application_id uuid,
  target_next_status text,
  transition_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.transition_application_status(target_application_id, target_next_status, transition_note);
end;
$$;

create or replace function private.hire_application(
  target_application_id uuid,
  target_employee_number text,
  target_department_id bigint,
  target_position_id bigint,
  target_employment_started_on date,
  decision_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  application_row public.applications%rowtype;
  applicant_row public.applicants%rowtype;
  employee_profile public.profiles%rowtype;
  new_employee_id uuid;
begin
  if caller_id is null or not exists (
    select 1
    from public.user_roles role
    join public.profiles profile on profile.id = role.user_id
    where role.user_id = caller_id
      and role.role = 'hr_personnel'::public.app_role
      and profile.is_active
  ) then
    raise exception 'HR access is required.' using errcode = '42501';
  end if;

  select application.* into application_row
  from public.applications application
  where application.id = target_application_id
  for update;

  if application_row.id is null then
    raise exception 'Application was not found.' using errcode = 'P0001';
  end if;
  if application_row.status not in ('Shortlisted', 'Interview') then
    raise exception 'Only shortlisted or interviewed applications can be hired.' using errcode = '22023';
  end if;

  select applicant.* into applicant_row from public.applicants applicant where applicant.id = application_row.applicant_id;
  select profile.* into employee_profile from public.profiles profile where profile.id = applicant_row.profile_id;
  if employee_profile.id is null or employee_profile.email is null then
    raise exception 'Applicant account profile is incomplete.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.employees employee where employee.profile_id = applicant_row.profile_id) then
    raise exception 'The applicant already has an employee record.' using errcode = '23505';
  end if;
  if not exists (select 1 from public.departments department where department.id = target_department_id and department.is_active) then
    raise exception 'Select an active department.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.positions position
    where position.id = target_position_id
      and position.department_id = target_department_id
      and position.is_active
  ) then
    raise exception 'Select an active position in the chosen department.' using errcode = '22023';
  end if;

  insert into public.employees (
    profile_id, employee_number, first_name, middle_name, last_name, personal_email,
    phone, address, department_id, position_id, employment_status, employment_started_on
  ) values (
    applicant_row.profile_id, upper(btrim(target_employee_number)), applicant_row.first_name,
    applicant_row.middle_name, applicant_row.last_name, lower(btrim(employee_profile.email)),
    applicant_row.phone, applicant_row.address, target_department_id, target_position_id,
    'active', target_employment_started_on
  ) returning id into new_employee_id;

  update public.applications
  set status = 'Hired', hired_employee_id = new_employee_id, reviewed_at = coalesce(reviewed_at, now()), updated_at = now()
  where id = target_application_id;

  insert into public.employee_activation_requests (employee_id, profile_id, application_id, requested_by_user_id)
  values (new_employee_id, applicant_row.profile_id, target_application_id, caller_id);
  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, application_row.status, 'Hired', nullif(btrim(decision_note), ''));
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'applications', target_application_id::text, 'hired', jsonb_build_object('employee_id', new_employee_id, 'profile_id', applicant_row.profile_id));

  return new_employee_id;
end;
$$;

create or replace function public.hire_application(
  target_application_id uuid,
  target_employee_number text,
  target_department_id bigint,
  target_position_id bigint,
  target_employment_started_on date,
  decision_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.hire_application(target_application_id, target_employee_number, target_department_id, target_position_id, target_employment_started_on, decision_note);
end;
$$;

revoke all on function private.transition_application_status(uuid, text, text), private.hire_application(uuid, text, bigint, bigint, date, text) from public, anon, authenticated;
revoke all on function public.transition_application_status(uuid, text, text), public.hire_application(uuid, text, bigint, bigint, date, text) from public, anon;
grant execute on function public.transition_application_status(uuid, text, text), public.hire_application(uuid, text, bigint, bigint, date, text) to authenticated;

create or replace function private.update_managed_user(
  target_user_id uuid,
  next_role public.app_role,
  next_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_current_role public.app_role;
  current_is_active boolean;
  active_administrator_count integer;
begin
  if actor_user_id is null or not exists (
    select 1 from public.user_roles user_role
    join public.profiles profile on profile.id = user_role.user_id
    where user_role.user_id = actor_user_id
      and user_role.role = 'system_administrator'::public.app_role
      and profile.is_active
  ) then raise exception 'Administrator access is required.' using errcode = '42501'; end if;

  lock table public.user_roles, public.profiles, public.employee_activation_requests in share row exclusive mode;
  select role into target_current_role from public.user_roles where user_id = target_user_id;
  select is_active into current_is_active from public.profiles where id = target_user_id;
  if target_current_role is null or current_is_active is null then raise exception 'Managed account was not found.' using errcode = 'P0001'; end if;
  if target_user_id = actor_user_id and (next_role <> 'system_administrator'::public.app_role or not next_is_active) then raise exception 'Administrators cannot remove their own administrator role or deactivate themselves.' using errcode = 'P0001'; end if;
  if target_current_role = 'system_administrator'::public.app_role and current_is_active and (next_role <> 'system_administrator'::public.app_role or not next_is_active) then
    select count(*) into active_administrator_count from public.user_roles user_role join public.profiles profile on profile.id = user_role.user_id where user_role.role = 'system_administrator'::public.app_role and profile.is_active;
    if active_administrator_count = 1 then raise exception 'At least one active system administrator is required.' using errcode = 'P0001'; end if;
  end if;
  update public.user_roles set role = next_role, assigned_by = actor_user_id, assigned_at = now() where user_id = target_user_id and role is distinct from next_role;
  update public.profiles set is_active = next_is_active where id = target_user_id and is_active is distinct from next_is_active;
  if next_role = 'employee'::public.app_role and next_is_active then
    update public.employee_activation_requests
    set status = 'activated', activated_by_user_id = actor_user_id, activated_at = now()
    where profile_id = target_user_id and status = 'pending';
  end if;
end;
$$;
