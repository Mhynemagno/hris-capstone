create sequence public.applicant_number_seq
  as bigint
  minvalue 1
  maxvalue 999999
  start with 1
  increment by 1
  no cycle;

alter table public.applicants
  add column applicant_number bigint;

update public.applicants
set applicant_number = nextval('public.applicant_number_seq');

alter table public.applicants
  alter column applicant_number set default nextval('public.applicant_number_seq'),
  alter column applicant_number set not null,
  add constraint applicants_applicant_number_range
    check (applicant_number between 1 and 999999),
  add constraint applicants_applicant_number_key unique (applicant_number),
  add column qualifier text check (qualifier is null or (qualifier = btrim(qualifier) and char_length(qualifier) between 1 and 40)),
  add column place_of_birth text check (place_of_birth is null or (place_of_birth = btrim(place_of_birth) and char_length(place_of_birth) between 1 and 160)),
  add column date_of_birth date check (date_of_birth is null or date_of_birth <= current_date),
  add column sex text check (sex is null or (sex = btrim(sex) and char_length(sex) between 1 and 40)),
  add column civil_status text check (civil_status is null or (civil_status = btrim(civil_status) and char_length(civil_status) between 1 and 80)),
  add column religion text check (religion is null or (religion = btrim(religion) and char_length(religion) between 1 and 120)),
  add column profile_image_path text check (
    profile_image_path is null
    or profile_image_path ~ '^applicants/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
  );

select setval(
  'public.applicant_number_seq',
  greatest((select coalesce(max(applicant_number), 0) from public.applicants), 1),
  (select count(*) > 0 from public.applicants)
);

create or replace function public.format_applicant_number(value bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select substr(lpad(value::text, 6, '0'), 1, 1)
    || '-' || substr(lpad(value::text, 6, '0'), 2, 5)
$$;

alter table public.employees
  add column qualifier text check (qualifier is null or (qualifier = btrim(qualifier) and char_length(qualifier) between 1 and 40)),
  add column place_of_birth text check (place_of_birth is null or (place_of_birth = btrim(place_of_birth) and char_length(place_of_birth) between 1 and 160)),
  add column date_of_birth date check (date_of_birth is null or date_of_birth <= current_date),
  add column sex text check (sex is null or (sex = btrim(sex) and char_length(sex) between 1 and 40)),
  add column civil_status text check (civil_status is null or (civil_status = btrim(civil_status) and char_length(civil_status) between 1 and 80)),
  add column religion text check (religion is null or (religion = btrim(religion) and char_length(religion) between 1 and 120));

revoke insert, update on public.applicants from authenticated;
grant insert (
  profile_id, first_name, middle_name, last_name, phone, address,
  qualifier, place_of_birth, date_of_birth, sex, civil_status, religion
) on public.applicants to authenticated;
grant update (
  first_name, middle_name, last_name, phone, address,
  qualifier, place_of_birth, date_of_birth, sex, civil_status, religion
) on public.applicants to authenticated;

create table public.applicant_profile_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  kind text not null check (kind in ('eligibility', 'diploma')),
  object_path text not null unique check (
    object_path = btrim(object_path)
    and object_path ~ '^applicant-profiles/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpe?g)$'
  ),
  file_name text not null check (file_name ~ '^[^\\/[:cntrl:]]{1,255}$'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, kind)
);

create index applicant_profile_documents_applicant_id_idx
  on public.applicant_profile_documents (applicant_id);
create index applicant_profile_documents_uploaded_by_user_id_idx
  on public.applicant_profile_documents (uploaded_by_user_id);

create trigger applicant_profile_documents_touch_updated_at
  before update on public.applicant_profile_documents
  for each row execute procedure private.touch_updated_at();

alter table public.applicant_profile_documents enable row level security;
revoke all on public.applicant_profile_documents from anon, authenticated;
grant select on public.applicant_profile_documents to authenticated;

create policy applicant_profile_documents_select_own_or_hr
  on public.applicant_profile_documents for select to authenticated
  using (
    exists (
      select 1
      from public.applicants applicant
      where applicant.id = applicant_profile_documents.applicant_id
        and applicant.profile_id = (select auth.uid())
    )
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'applicant-profile-photos',
  'applicant-profile-photos',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'applicant-profile-documents',
  'applicant-profile-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy applicant_profile_photos_select_own_or_hr
  on storage.objects for select to authenticated
  using (
    bucket_id = 'applicant-profile-photos'
    and (
      (select private.current_user_has_role('hr_personnel'::public.app_role))
      or exists (
        select 1
        from public.applicants applicant
        where applicant.profile_id = (select auth.uid())
          and name like 'applicants/' || applicant.id::text || '/%'
      )
    )
  );

create policy applicant_profile_photos_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-profile-photos'
    and name ~ '^applicants/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
    and exists (
      select 1
      from public.applicants applicant
      where applicant.profile_id = (select auth.uid())
        and name like 'applicants/' || applicant.id::text || '/%'
    )
  );

create policy applicant_profile_photos_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'applicant-profile-photos'
    and exists (
      select 1
      from public.applicants applicant
      where applicant.profile_id = (select auth.uid())
        and name like 'applicants/' || applicant.id::text || '/%'
    )
  );

create policy applicant_profile_documents_select_own_or_hr
  on storage.objects for select to authenticated
  using (
    bucket_id = 'applicant-profile-documents'
    and (
      (select private.current_user_has_role('hr_personnel'::public.app_role))
      or name like 'applicant-profiles/' || (select auth.uid())::text || '/%'
    )
  );

create policy applicant_profile_documents_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-profile-documents'
    and name ~ '^applicant-profiles/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpe?g)$'
    and name like 'applicant-profiles/' || (select auth.uid())::text || '/%'
  );

create policy applicant_profile_documents_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'applicant-profile-documents'
    and name like 'applicant-profiles/' || (select auth.uid())::text || '/%'
  );

create or replace function public.update_my_applicant_profile_image_path(target_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_applicant_id uuid;
begin
  select applicant.id
  into caller_applicant_id
  from public.applicants applicant
  where applicant.profile_id = caller_id;

  if caller_applicant_id is null then
    raise exception 'Only an applicant can update a profile photo.' using errcode = '42501';
  end if;

  if target_path is not null
    and target_path !~ (
      '^applicants/' || caller_applicant_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp)$'
    ) then
    raise exception 'Profile photo path must belong to the applicant.' using errcode = '42501';
  end if;

  update public.applicants
  set profile_image_path = target_path
  where id = caller_applicant_id;
end;
$$;

create or replace function public.save_my_applicant_profile_document(
  target_kind text,
  target_object_path text,
  target_file_name text,
  target_mime_type text,
  target_size_bytes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_applicant_id uuid;
begin
  select applicant.id
  into caller_applicant_id
  from public.applicants applicant
  where applicant.profile_id = caller_id;

  if caller_applicant_id is null then
    raise exception 'Only an applicant can save profile documents.' using errcode = '42501';
  end if;

  if target_kind not in ('eligibility', 'diploma')
    or target_object_path !~ (
      '^applicant-profiles/' || caller_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$'
    )
    or target_file_name !~ '^[^\\/[:cntrl:]]{1,255}$'
    or target_mime_type not in ('application/pdf', 'image/png', 'image/jpeg')
    or target_size_bytes not between 1 and 10485760
    or not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'applicant-profile-documents'
        and object.name = target_object_path
        and object.owner_id = caller_id::text
    ) then
    raise exception 'Invalid applicant profile document.' using errcode = '22023';
  end if;

  insert into public.applicant_profile_documents (
    applicant_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id
  ) values (
    caller_applicant_id, target_kind, target_object_path, target_file_name,
    target_mime_type, target_size_bytes, caller_id
  )
  on conflict (applicant_id, kind) do update
  set object_path = excluded.object_path,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      uploaded_by_user_id = excluded.uploaded_by_user_id,
      updated_at = clock_timestamp();
end;
$$;

revoke all on function public.update_my_applicant_profile_image_path(text) from public, anon;
grant execute on function public.update_my_applicant_profile_image_path(text) to authenticated;
revoke all on function public.save_my_applicant_profile_document(text, text, text, text, integer) from public, anon;
grant execute on function public.save_my_applicant_profile_document(text, text, text, text, integer) to authenticated;
