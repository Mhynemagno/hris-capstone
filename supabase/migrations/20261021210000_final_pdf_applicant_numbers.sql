-- Final Revisions.pdf p. 15: a number identifies every applicant, even when
-- documents were not submitted or the applicant was not qualified. It is a
-- stable identifier for returning/reactivated applicant accounts, not an
-- acceptance reward.

drop trigger if exists applications_assign_applicant_number on public.applications;
drop function if exists private.assign_applicant_number_on_acceptance();

create or replace function private.assign_applicant_number_on_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  registered_at timestamptz;
begin
  select profile.created_at into registered_at
  from public.profiles profile
  where profile.id = new.profile_id;

  new.applicant_number := private.next_applicant_number(
    private.applicant_registration_year(coalesce(registered_at, new.created_at, now()))
  );
  return new;
end;
$$;

revoke all on function private.assign_applicant_number_on_registration() from public, anon, authenticated;

drop trigger if exists applicants_assign_applicant_number on public.applicants;
create trigger applicants_assign_applicant_number
  before insert on public.applicants
  for each row execute function private.assign_applicant_number_on_registration();

-- Preserve existing records and fill only identifiers omitted under the former
-- "on acceptance" rule. Numbers already issued are never changed.
update public.applicants applicant
set applicant_number = private.next_applicant_number(
  private.applicant_registration_year(coalesce(profile.created_at, applicant.created_at, now()))
)
from public.profiles profile
where applicant.applicant_number is null
  and profile.id = applicant.profile_id;

-- Profile-less legacy applicants are still retained and receive a number.
update public.applicants applicant
set applicant_number = private.next_applicant_number(
  private.applicant_registration_year(coalesce(applicant.created_at, now()))
)
where applicant.applicant_number is null;

alter table public.applicants
  alter column applicant_number set not null;

create or replace function private.prevent_applicant_number_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.applicant_number is distinct from old.applicant_number then
    raise exception 'Applicant number cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_applicant_number_change() from public, anon, authenticated;

drop trigger if exists applicants_prevent_applicant_number_change on public.applicants;
create trigger applicants_prevent_applicant_number_change
  before update of applicant_number on public.applicants
  for each row execute function private.prevent_applicant_number_change();
