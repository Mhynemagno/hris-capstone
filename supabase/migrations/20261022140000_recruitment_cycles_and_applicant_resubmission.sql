-- Final Revisions PDF p. 15 (audit fixes, 2026-10-22):
--   * Every registered applicant has an applicant number. The HR directory now lists only accounts that
--     have an applicant record (and therefore a number), and reports whether the account can sign in.
--   * A not-qualified applicant keeps their record. HR can reactivate the applicant account, and can
--     reopen a Not Selected application so the applicant can resubmit documents. ("Send new credentials"
--     is a password-reset email sent from the client with Supabase Auth.)
--   * Recruitment opens twice a year: Cycle 1 (January–June) and Cycle 2 (July–December). Each opening
--     belongs to the cycle of its opening date, and its deadline must fall within that cycle.

-- ---------------------------------------------------------------------------
-- HR registered-applicant directory
-- ---------------------------------------------------------------------------

drop function public.list_hr_registered_applicants();

create function public.list_hr_registered_applicants()
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
  account_active boolean,
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
    profile.is_active,
    coalesce(application_totals.total, 0),
    latest.id,
    latest.status,
    latest.title,
    latest.submitted_at
  from public.user_roles user_role
  join public.profiles profile on profile.id = user_role.user_id
  join auth.users account on account.id = user_role.user_id
  -- Inner join: a registered applicant is an applicant-role account with an applicant record, and every
  -- applicant record carries a number (20261021210000_final_pdf_applicant_numbers.sql).
  join public.applicants applicant on applicant.profile_id = user_role.user_id
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

-- ---------------------------------------------------------------------------
-- HR reactivates an applicant account. Setting profiles.is_active lifts the Supabase Auth ban
-- (private.sync_auth_sign_in_block) and writes the activation audit row
-- (private.audit_profile_activation_change); this RPC adds who reactivated it and why.
-- ---------------------------------------------------------------------------

create function public.reactivate_applicant_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  target_is_active boolean;
begin
  select profile.is_active into target_is_active
  from public.profiles profile
  join public.user_roles user_role on user_role.user_id = profile.id
  where profile.id = target_user_id and user_role.role = 'applicant'::public.app_role
  for update of profile;

  if target_is_active is null then
    raise exception 'Applicant account was not found.' using errcode = 'P0001';
  end if;
  if target_is_active then
    return;
  end if;

  update public.profiles set is_active = true where id = target_user_id;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'profiles', target_user_id::text, 'applicant_account_reactivated', jsonb_build_object('role', 'applicant'));

  insert into public.notifications (recipient_user_id, type, title, body, link)
  values (target_user_id, 'application_status_updated', 'Account reactivated', 'HR reactivated your applicant account. You can sign in again.', '/applicant');
end;
$$;

revoke all on function public.reactivate_applicant_account(uuid) from public, anon;
grant execute on function public.reactivate_applicant_account(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- HR reopens a Not Selected application for resubmission. The application returns to Application
-- Submission (Pending / For Evaluation); the applicant replaces documents on the Documents page and HR
-- verifies them again. History, stage documents and remarks are kept.
-- ---------------------------------------------------------------------------

create function public.reopen_application_for_resubmission(target_application_id uuid, target_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_active_hr();
  application_row public.applications%rowtype;
  recipient_profile_id uuid;
  clean_note text := nullif(btrim(target_note), '');
begin
  if clean_note is not null and char_length(clean_note) > 2000 then
    raise exception 'Notes must be at most 2000 characters.' using errcode = '22023';
  end if;
  select * into application_row from public.applications where id = target_application_id for update;
  if application_row.id is null then raise exception 'Application was not found.' using errcode = 'P0001'; end if;
  if application_row.status <> 'Not Selected' then
    raise exception 'Only a Not Selected application can be reopened for resubmission.' using errcode = '22023';
  end if;
  select applicant.profile_id into recipient_profile_id from public.applicants applicant where applicant.id = application_row.applicant_id;

  update public.applications set
    status = 'Application Submission',
    stage_result = 'pending',
    stage_scheduled_at = null,
    stage_venue = null,
    updated_at = now()
  where id = target_application_id;

  insert into public.application_status_history (application_id, actor_user_id, previous_status, next_status, note)
  values (target_application_id, caller_id, 'Not Selected', 'Application Submission', coalesce(clean_note, 'Reopened for resubmission.'));

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, metadata)
  values (caller_id, 'applications', target_application_id::text, 'reopened_for_resubmission', jsonb_build_object('previous_status', 'Not Selected', 'next_status', 'Application Submission'));

  if recipient_profile_id is not null then
    insert into public.notifications (recipient_user_id, type, title, body, link)
    values (
      recipient_profile_id,
      'application_status_updated',
      'Application reopened',
      'HR reopened your application. Update your documents on the Documents page and HR will review them again.' || coalesce(' Note: ' || clean_note, ''),
      '/applicant/applications'
    );
  end if;
end;
$$;

revoke all on function public.reopen_application_for_resubmission(uuid, text) from public, anon;
grant execute on function public.reopen_application_for_resubmission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Recruitment cycles
-- ---------------------------------------------------------------------------

alter table public.job_openings
  add column recruitment_cycle smallint,
  add column recruitment_year integer;

-- Backfill from the opening date (published, else created) without touching updated_at, which orders
-- the HR list.
alter table public.job_openings disable trigger job_openings_touch_updated_at;
update public.job_openings opening
set recruitment_cycle = case when extract(month from (coalesce(opening.published_at, opening.created_at) at time zone 'Asia/Manila')) <= 6 then 1 else 2 end,
    recruitment_year = extract(year from (coalesce(opening.published_at, opening.created_at) at time zone 'Asia/Manila'))::integer;
alter table public.job_openings enable trigger job_openings_touch_updated_at;

alter table public.job_openings
  alter column recruitment_cycle set not null,
  alter column recruitment_year set not null,
  add constraint job_openings_recruitment_cycle_check check (recruitment_cycle in (1, 2)),
  add constraint job_openings_recruitment_year_check check (recruitment_year between 2000 and 2200);

-- The last day of a cycle: June 30 (Cycle 1) or December 31 (Cycle 2).
create function private.recruitment_cycle_end(target_cycle smallint, target_year integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case when target_cycle = 1 then make_date(target_year, 6, 30) else make_date(target_year, 12, 31) end;
$$;

revoke all on function private.recruitment_cycle_end(smallint, integer) from public, anon, authenticated;

-- The opening date is published_at; a draft is dated today (the day it would open if published now).
-- A closed opening keeps the cycle it ran in. The deadline rule is enforced only when the deadline,
-- status or publication changes, so existing openings are never rejected by unrelated edits.
create function private.assign_job_opening_recruitment_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  opening_date date;
  cycle_end date;
begin
  if tg_op = 'UPDATE' and new.published_at is null and new.status = 'closed' then
    new.recruitment_cycle := old.recruitment_cycle;
    new.recruitment_year := old.recruitment_year;
    return new;
  end if;

  opening_date := (coalesce(new.published_at, now()) at time zone 'Asia/Manila')::date;
  new.recruitment_cycle := case when extract(month from opening_date) <= 6 then 1 else 2 end;
  new.recruitment_year := extract(year from opening_date)::integer;

  if new.closes_on is not null and (
    tg_op = 'INSERT'
    or new.closes_on is distinct from old.closes_on
    or new.status is distinct from old.status
    or new.published_at is distinct from old.published_at
  ) then
    cycle_end := private.recruitment_cycle_end(new.recruitment_cycle, new.recruitment_year);
    if new.closes_on > cycle_end then
      raise exception 'The deadline of application must fall within Cycle % (% %). Choose a date on or before %.',
        new.recruitment_cycle,
        case when new.recruitment_cycle = 1 then 'January–June' else 'July–December' end,
        new.recruitment_year,
        to_char(cycle_end, 'FMMonth FMDD, YYYY')
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.assign_job_opening_recruitment_cycle() from public, anon, authenticated;

create trigger job_openings_assign_recruitment_cycle
  before insert or update of published_at, status, closes_on, recruitment_cycle, recruitment_year on public.job_openings
  for each row execute function private.assign_job_opening_recruitment_cycle();
