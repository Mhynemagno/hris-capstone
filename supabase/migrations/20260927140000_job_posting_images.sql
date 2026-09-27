-- Recruitment feedback (2026-09-27): a job posting can carry an optional image so postings are not plain text.
--   * job_openings.image_path (nullable) holds the object path inside the public `job-posting-images` bucket.
--     It is covered by the existing table grants and RLS, so the public /jobs reads return it.
--   * The `job-posting-images` bucket is public-read (PNG/JPEG/WebP up to 5 MiB); only HR personnel can
--     upload, replace or delete objects, under job-openings/<job id>/<uuid>.<ext>.
--   * public.set_job_opening_image(job id, path) lets HR set or clear the path; it returns the previous
--     path so the client can delete the replaced object.

alter table public.job_openings add column image_path text
  constraint job_openings_image_path_format check (image_path ~ '^job-openings/[0-9]+/[0-9a-f-]{36}\.(png|jpe?g|webp)$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-posting-images', 'job-posting-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy job_posting_images_select_all
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'job-posting-images');

create policy job_posting_images_insert_hr
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-posting-images'
    and name ~ '^job-openings/[0-9]+/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create policy job_posting_images_update_hr
  on storage.objects for update to authenticated
  using (bucket_id = 'job-posting-images' and (select private.current_user_has_role('hr_personnel'::public.app_role)))
  with check (
    bucket_id = 'job-posting-images'
    and name ~ '^job-openings/[0-9]+/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
    and (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create policy job_posting_images_delete_hr
  on storage.objects for delete to authenticated
  using (bucket_id = 'job-posting-images' and (select private.current_user_has_role('hr_personnel'::public.app_role)));

create or replace function private.set_job_opening_image(target_job_id bigint, target_image_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  previous_path text;
begin
  if caller_id is null or not (select private.current_user_has_role('hr_personnel'::public.app_role)) then
    raise exception 'Human Resources access is required.' using errcode = '42501';
  end if;
  if target_image_path is not null and target_image_path !~ ('^job-openings/' || target_job_id::text || '/[0-9a-f-]{36}\.(png|jpe?g|webp)$') then
    raise exception 'Job posting image is invalid.' using errcode = '22023';
  end if;
  select image_path into previous_path from public.job_openings where id = target_job_id for update;
  if not found then raise exception 'Job opening was not found.' using errcode = 'P0001'; end if;
  if target_image_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'job-posting-images' and name = target_image_path
  ) then
    raise exception 'Upload the job posting image before saving it.' using errcode = '22023';
  end if;
  update public.job_openings set image_path = target_image_path where id = target_job_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'job_openings', target_job_id::text, 'updated', jsonb_build_object('image', case when target_image_path is null then 'removed' else 'set' end));
  return previous_path;
end;
$$;

create or replace function public.set_job_opening_image(target_job_id bigint, target_image_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.set_job_opening_image(target_job_id, target_image_path);
end;
$$;

revoke all on function private.set_job_opening_image(bigint, text) from public, anon, authenticated;
revoke all on function public.set_job_opening_image(bigint, text) from public, anon;
grant execute on function public.set_job_opening_image(bigint, text) to authenticated, service_role;
