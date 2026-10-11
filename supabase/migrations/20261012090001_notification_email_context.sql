-- Final Changes PDF (Oct 2026): notification emails follow the client's emailud.html (applicants) and
-- emailemp.html (personnel) designs. Those show the recipient's name, applicant number and status, or
-- rank, badge number and deployment, so the email worker reads them per claimed job from here.

create function private.notification_email_context(target_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  applicant_context jsonb;
  employee_context jsonb;
begin
  select job.recipient_user_id into recipient
  from private.notification_email_outbox job
  where job.id = target_job_id;

  if recipient is null then
    return null;
  end if;

  select jsonb_build_object(
    'applicant_first_name', applicant.first_name,
    'applicant_number', case when applicant.applicant_number is null then null else public.format_applicant_number(applicant.applicant_number) end,
    'application_status', application.status,
    'application_stage_result', application.stage_result,
    'application_submitted_at', application.submitted_at
  ) into applicant_context
  from public.applicants applicant
  left join lateral (
    select candidate.status, candidate.stage_result, candidate.submitted_at
    from public.applications candidate
    where candidate.applicant_id = applicant.id
    order by candidate.updated_at desc
    limit 1
  ) application on true
  where applicant.profile_id = recipient;

  select jsonb_build_object(
    'employee_first_name', employee.first_name,
    'employee_last_name', employee.last_name,
    'rank_code', rank.code,
    'badge_number', employee.employee_number,
    'deployment_location', coalesce(deployment.location, deployment.unit, deployment.project),
    'deployment_role', deployment.assignment_role,
    'deployment_starts_on', deployment.starts_on,
    'deployment_ends_on', deployment.ends_on
  ) into employee_context
  from public.employees employee
  left join public.ranks rank on rank.id = employee.rank_id
  left join lateral (
    select candidate.location, candidate.unit, candidate.project, candidate.assignment_role, candidate.starts_on, candidate.ends_on
    from public.deployments candidate
    where candidate.employee_id = employee.id
    order by candidate.updated_at desc
    limit 1
  ) deployment on true
  where employee.profile_id = recipient;

  -- A SELECT INTO that finds no row leaves its variable null, so each half falls back to an empty object.
  return coalesce(applicant_context, '{}'::jsonb) || coalesce(employee_context, '{}'::jsonb);
end;
$$;

create function public.notification_email_context(target_job_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.notification_email_context(target_job_id);
$$;

revoke all on function private.notification_email_context(uuid) from public, anon, authenticated, service_role;
revoke all on function public.notification_email_context(uuid) from public, anon, authenticated, service_role;
grant execute on function public.notification_email_context(uuid) to service_role;
