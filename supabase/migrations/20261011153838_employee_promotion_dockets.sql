-- Employee promotion status is derived from the next active rank rather than a past HR review.
-- Dockets are employee-submitted evidence of readiness; HR keeps the existing official evaluation
-- and decision workflow. This migration is local-only until explicitly applied to a hosted project.

create table public.employee_promotion_dockets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  criterion_id uuid not null references public.promotion_criteria (id) on delete restrict,
  remarks text not null check (remarks = btrim(remarks) and char_length(remarks) between 1 and 2000),
  submitted_at timestamptz not null default now(),
  unique (employee_id, criterion_id)
);

create index employee_promotion_dockets_criterion_submitted_idx
  on public.employee_promotion_dockets (criterion_id, submitted_at desc);

alter table public.employee_promotion_dockets enable row level security;
revoke all on public.employee_promotion_dockets from public, anon, authenticated;
grant select on public.employee_promotion_dockets to authenticated, service_role;

create policy employee_promotion_dockets_select_own_or_hr
  on public.employee_promotion_dockets for select to authenticated
  using (
    exists (
      select 1 from public.employees employee
      where employee.id = employee_promotion_dockets.employee_id
        and employee.profile_id = (select auth.uid())
    )
    or (select private.current_user_has_role('hr_personnel'::public.app_role))
  );

create or replace function public.get_my_promotion_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  own_employee_id uuid := private.require_active_employee_self();
  response jsonb;
begin
  select jsonb_build_object(
    'criterionId', criterion.id,
    'currentRankName', current_rank.name,
    'targetRankName', target_rank.name,
    'targetRankCode', target_rank.code,
    'evaluatedOn', null,
    'docket', (
      select jsonb_build_object(
        'id', docket.id,
        'criterionId', docket.criterion_id,
        'remarks', docket.remarks,
        'submittedAt', docket.submitted_at
      )
      from public.employee_promotion_dockets docket
      where docket.employee_id = employee.id
        and docket.criterion_id = criterion.id
    ),
    'readiness', private.promotion_readiness(employee.id, criterion.id, (now() at time zone 'Asia/Manila')::date)
  ) into response
  from public.employees employee
  join public.ranks current_rank on current_rank.id = employee.rank_id and current_rank.is_active
  join lateral (
    select next_rank.*
    from public.ranks next_rank
    where next_rank.is_active
      and next_rank.sort_order > current_rank.sort_order
    order by next_rank.sort_order
    limit 1
  ) target_rank on true
  join public.promotion_criteria criterion
    on criterion.target_rank_id = target_rank.id
   and criterion.is_active
  where employee.id = own_employee_id
    and employee.employment_status = 'active';

  return response;
end;
$$;

create or replace function public.submit_employee_promotion_docket(
  target_criterion_id uuid,
  target_remarks text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  own_employee_id uuid := private.require_active_employee_self();
  caller_id uuid := (select auth.uid());
  clean_remarks text := btrim(coalesce(target_remarks, ''));
  matched_criterion_id uuid;
  readiness jsonb;
  docket_id uuid;
begin
  if char_length(clean_remarks) not between 1 and 2000 then
    raise exception 'Promotion docket remarks must be between 1 and 2000 characters.' using errcode = '22023';
  end if;

  select criterion.id, private.promotion_readiness(employee.id, criterion.id, (now() at time zone 'Asia/Manila')::date)
    into matched_criterion_id, readiness
  from public.employees employee
  join public.ranks current_rank on current_rank.id = employee.rank_id and current_rank.is_active
  join lateral (
    select next_rank.*
    from public.ranks next_rank
    where next_rank.is_active
      and next_rank.sort_order > current_rank.sort_order
    order by next_rank.sort_order
    limit 1
  ) target_rank on true
  join public.promotion_criteria criterion
    on criterion.target_rank_id = target_rank.id
   and criterion.is_active
  where employee.id = own_employee_id
    and employee.employment_status = 'active'
  for key share of employee;

  if matched_criterion_id is null or matched_criterion_id is distinct from target_criterion_id then
    raise exception 'This criterion is not available for your immediate next rank.' using errcode = 'P0001';
  end if;
  if coalesce((readiness ->> 'isReady')::boolean, false) is not true then
    raise exception 'Your current records do not yet meet this promotion criterion.' using errcode = 'P0001';
  end if;

  insert into public.employee_promotion_dockets (employee_id, criterion_id, remarks)
  values (own_employee_id, matched_criterion_id, clean_remarks)
  returning id into docket_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (
    caller_id,
    'employee_promotion_dockets',
    docket_id::text,
    'submitted',
    jsonb_build_object('employee_id', own_employee_id, 'criterion_id', matched_criterion_id)
  );

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (
    caller_id,
    'promotion_docket_submitted',
    'Promotion docket submitted',
    'Your promotion docket has been submitted to HR for review.',
    '/employee/promotion-eligibility'
  );

  return docket_id;
end;
$$;

-- HR, SysAd, management, and employee accounts with an active linked personnel record may use the same
-- badge-number entry point. Their assigned role still determines the post-login destination.
create or replace function public.resolve_login_identifier(target_mode text, target_identifier text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_email text;
  normalized_identifier text := btrim(coalesce(target_identifier, ''));
begin
  if target_mode = 'applicant' then
    normalized_identifier := regexp_replace(normalized_identifier, '[^0-9]', '', 'g');
    if normalized_identifier !~ '^[0-9]{6,}$' then return null; end if;
    select profile.email into resolved_email
      from public.applicants applicant
      join public.profiles profile on profile.id = applicant.profile_id
     where applicant.applicant_number = normalized_identifier::bigint;
  elsif target_mode = 'employee' then
    if normalized_identifier = '' then return null; end if;
    select profile.email into resolved_email
      from public.employees employee
      join public.profiles profile on profile.id = employee.profile_id
      join public.user_roles user_role on user_role.user_id = profile.id
     where upper(employee.employee_number) = upper(normalized_identifier)
       and employee.employment_status = 'active'
       and profile.is_active
       and user_role.role in ('employee'::public.app_role, 'hr_personnel'::public.app_role, 'management'::public.app_role, 'system_administrator'::public.app_role);
  else
    return null;
  end if;
  return resolved_email;
end;
$$;

revoke all on function public.get_my_promotion_readiness(), public.submit_employee_promotion_docket(uuid, text) from public, anon;
grant execute on function public.get_my_promotion_readiness(), public.submit_employee_promotion_docket(uuid, text) to authenticated;

revoke all on function public.resolve_login_identifier(text, text) from public, anon, authenticated;
grant execute on function public.resolve_login_identifier(text, text) to service_role;
