alter table public.employees
  add column rank text check (
    rank is null or rank in (
      'Patrolman / Patrolwoman (PAT)',
      'Police Corporal (PCpl)',
      'Police Staff Sergeant (PSSg)',
      'Police Master Sergeant (PMSg)',
      'Police Senior Master Sergeant (PSMS)',
      'Police Chief Master Sergeant (PCMS)',
      'Police Executive Master Sergeant (PEMS)',
      'Police Lieutenant (PLT)',
      'Police Captain (PCPT)',
      'Police Major (PMAJ)',
      'Police Lieutenant Colonel (PLTCOL)',
      'Police Colonel (PCOL)',
      'Police Brigadier General (PBGEN)',
      'Police Major General (PMGEN)',
      'Police Lieutenant General (PLTGEN)',
      'Police General (PGEN)'
    )
  ),
  add column unit_station text check (unit_station is null or char_length(btrim(unit_station)) between 1 and 160),
  add column profile_image_path text check (
    profile_image_path is null
    or (
      profile_image_path like 'employees/' || id::text || '/%'
      and profile_image_path ~ '^employees/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-profile-photos',
  'employee-profile-photos',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy employee_profile_photos_select_employee_hr_or_admin
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employee-profile-photos'
    and (
      (select private.current_user_has_role('hr_personnel'::public.app_role))
      or (select private.current_user_has_role('system_administrator'::public.app_role))
      or exists (
        select 1
        from public.employees employee
        where employee.profile_id = (select auth.uid())
          and name like 'employees/' || employee.id::text || '/%'
      )
    )
  );

create policy employee_profile_photos_insert_employee_or_hr
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employee-profile-photos'
    and name ~ '^employees/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
    and (
      (select private.current_user_has_role('hr_personnel'::public.app_role))
      or exists (
        select 1
        from public.employees employee
        where employee.profile_id = (select auth.uid())
          and name like 'employees/' || employee.id::text || '/%'
      )
    )
  );

create policy employee_profile_photos_delete_employee_or_hr
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'employee-profile-photos'
    and (
      (select private.current_user_has_role('hr_personnel'::public.app_role))
      or exists (
        select 1
        from public.employees employee
        where employee.profile_id = (select auth.uid())
          and name like 'employees/' || employee.id::text || '/%'
      )
    )
  );

create policy employees_select_system_administrator
  on public.employees for select to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)));

create policy training_records_select_system_administrator
  on public.training_records for select to authenticated
  using ((select private.current_user_has_role('system_administrator'::public.app_role)));

create or replace function public.submit_profile_change_request(
  target_request_id uuid,
  request_note text,
  requested_changes jsonb,
  requested_documents jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(requested_changes) change_item
    where change_item ->> 'kind' = 'contact'
      and change_item ->> 'field' = 'address'
  ) then
    raise exception 'Address changes are not collected through employee self-service.' using errcode = '22023';
  end if;

  perform private.submit_profile_change_request(
    target_request_id,
    request_note,
    requested_changes,
    requested_documents
  );
end;
$$;

revoke all on function public.submit_profile_change_request(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.submit_profile_change_request(uuid, text, jsonb, jsonb) to authenticated;
