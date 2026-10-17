-- Recruitment openings are historical once published or once an application exists.
-- Closed, never-used openings are safe to remove with their owned criteria.

create or replace function public.delete_job_opening(target_job_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_row public.job_openings%rowtype;
  deleted_criteria jsonb;
  application_total bigint;
begin
  perform private.require_active_hr();

  lock table public.job_openings, public.applications in share row exclusive mode;
  select * into deleted_row
  from public.job_openings
  where id = target_job_id
  for update;

  if not found then
    raise exception 'Job opening was not found.' using errcode = 'P0001';
  end if;
  if deleted_row.status not in ('draft', 'closed') then
    raise exception 'Only draft or closed openings with no applications can be deleted. Withdraw the opening to close it to applicants while keeping its applications and history.' using errcode = 'P0001';
  end if;

  select count(*) into application_total
  from public.applications
  where job_opening_id = target_job_id;
  if application_total > 0 then
    raise exception '% cannot be deleted. It is still used by % job applications. Withdraw the opening to close it to applicants while keeping its applications and history.', deleted_row.title, application_total using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(criterion) order by criterion.ordinal), '[]')
    into deleted_criteria
  from public.job_qualification_criteria criterion
  where criterion.job_opening_id = target_job_id;

  delete from public.job_openings where id = target_job_id;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (
    (select auth.uid()),
    'job_openings',
    deleted_row.id::text,
    'delete',
    to_jsonb(deleted_row) || jsonb_build_object('criteria', deleted_criteria)
  );
end;
$$;

revoke all on function public.delete_job_opening(bigint) from public, anon;
grant execute on function public.delete_job_opening(bigint) to authenticated, service_role;

-- The replacement names the full lifecycle; leave no browser-callable legacy path.
revoke all on function public.delete_draft_job_opening(bigint) from public, anon, authenticated;
