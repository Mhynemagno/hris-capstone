-- 1. Applicants can remove one of their required profile documents (Eligibility / Diploma) from
--    the Documents page. Removal is refused while an application is still being decided, because
--    HR is reviewing those documents; the applicant can upload a replacement instead. The RPC
--    returns the storage path so the client can delete the (now unreferenced) object.
-- 2. HR can list every registered applicant account, including accounts that have not applied
--    yet. Previously HR only saw submitted applications, so new applicant accounts were visible
--    only in the administrator audit log. Read-only; HR access is required.

create or replace function public.remove_my_applicant_profile_document(target_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_applicant_id uuid;
  removed_path text;
begin
  select applicant.id into caller_applicant_id
  from public.applicants applicant
  where applicant.profile_id = caller_id;

  if caller_applicant_id is null then
    raise exception 'Only an applicant can remove profile documents.' using errcode = '42501';
  end if;

  if target_kind is null or target_kind not in ('eligibility', 'diploma') then
    raise exception 'Invalid applicant profile document.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.applications application
    where application.applicant_id = caller_applicant_id
      and application.status not in ('Hired', 'Not Selected')
  ) then
    raise exception 'This document is under review for an application in progress. Upload a replacement instead of removing it.' using errcode = 'P0001';
  end if;

  delete from public.applicant_profile_documents document
  where document.applicant_id = caller_applicant_id and document.kind = target_kind
  returning document.object_path into removed_path;

  if removed_path is null then
    raise exception 'The document was not found.' using errcode = 'P0002';
  end if;

  return removed_path;
end;
$$;

revoke all on function public.remove_my_applicant_profile_document(text) from public, anon;
grant execute on function public.remove_my_applicant_profile_document(text) to authenticated;

create or replace function public.list_hr_registered_applicants()
returns table (
  user_id uuid,
  applicant_id uuid,
  applicant_number bigint,
  first_name text,
  middle_name text,
  last_name text,
  qualifier text,
  full_name text,
  email text,
  phone text,
  registered_at timestamptz,
  email_confirmed boolean,
  application_count bigint,
  latest_application_id uuid,
  latest_application_status text,
  latest_job_title text,
  latest_submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_active_hr();
  return query
  select
    user_role.user_id,
    applicant.id,
    applicant.applicant_number,
    applicant.first_name,
    applicant.middle_name,
    applicant.last_name,
    applicant.qualifier,
    profile.full_name,
    profile.email,
    applicant.phone,
    profile.created_at,
    account.email_confirmed_at is not null,
    coalesce(application_totals.total, 0),
    latest.id,
    latest.status,
    latest.title,
    latest.submitted_at
  from public.user_roles user_role
  join public.profiles profile on profile.id = user_role.user_id
  join auth.users account on account.id = user_role.user_id
  left join public.applicants applicant on applicant.profile_id = user_role.user_id
  left join lateral (
    select count(*) as total from public.applications application where application.applicant_id = applicant.id
  ) application_totals on true
  left join lateral (
    select application.id, application.status, opening.title, application.submitted_at
    from public.applications application
    join public.job_openings opening on opening.id = application.job_opening_id
    where application.applicant_id = applicant.id
    order by application.submitted_at desc, application.id
    limit 1
  ) latest on true
  where user_role.role = 'applicant'::public.app_role
  order by profile.created_at desc, user_role.user_id;
end;
$$;

revoke all on function public.list_hr_registered_applicants() from public, anon;
grant execute on function public.list_hr_registered_applicants() to authenticated;
