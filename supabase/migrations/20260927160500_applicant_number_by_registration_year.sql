-- Applicant numbers now follow the registration year: the stored number is the four-digit
-- registration year followed by that year's sequence, zero-padded to two digits (01 to 99, then
-- 100, 101 and so on). Displayed as "first digit - the rest", the first 2026 applicant 202601 reads
-- "2-02601"; the hundredth, 2026100, reads "2-026100".
--
-- The registration year is the Philippine calendar year the applicant account was created.
-- Numbers come from a per-year counter row, so concurrent registrations serialize on that row
-- and never share a number. Existing applicants are renumbered in registration order within
-- their registration year (ties keep the previous numbering order).

create table private.applicant_number_counters (
  registration_year integer primary key check (registration_year between 1000 and 9999),
  last_value integer not null check (last_value >= 1)
);

revoke all on table private.applicant_number_counters from public, anon, authenticated;

create or replace function private.applicant_registration_year(registered_at timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select extract(year from (coalesce(registered_at, now()) at time zone 'Asia/Manila'))::integer
$$;

create or replace function private.next_applicant_number(registration_year integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_value integer;
begin
  insert into private.applicant_number_counters as counter (registration_year, last_value)
  values (registration_year, 1)
  on conflict on constraint applicant_number_counters_pkey
  do update set last_value = counter.last_value + 1
  returning counter.last_value into next_value;

  -- Pad to two digits without truncating 100 and above (a plain lpad(..., 2) would cut 100 to "10").
  return (registration_year::text || lpad(next_value::text, greatest(2, char_length(next_value::text)), '0'))::bigint;
end;
$$;

revoke all on function private.applicant_registration_year(timestamptz) from public, anon, authenticated;
revoke all on function private.next_applicant_number(integer) from public, anon, authenticated;

create or replace function private.assign_applicant_number()
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

revoke all on function private.assign_applicant_number() from public, anon, authenticated;

alter table public.applicants
  alter column applicant_number drop default,
  drop constraint applicants_applicant_number_range;

-- Renumber existing applicants. Negate first so the new values never collide with old ones
-- under the unique constraint while the update runs.
update public.applicants set applicant_number = -applicant_number;

with ordered as (
  select
    applicant.id,
    private.applicant_registration_year(coalesce(profile.created_at, applicant.created_at)) as registration_year,
    row_number() over (
      partition by private.applicant_registration_year(coalesce(profile.created_at, applicant.created_at))
      order by coalesce(profile.created_at, applicant.created_at), -applicant.applicant_number, applicant.id
    ) as year_sequence
  from public.applicants applicant
  left join public.profiles profile on profile.id = applicant.profile_id
)
update public.applicants applicant
set applicant_number = (ordered.registration_year::text || lpad(ordered.year_sequence::text, greatest(2, char_length(ordered.year_sequence::text)), '0'))::bigint
from ordered
where ordered.id = applicant.id;

insert into private.applicant_number_counters (registration_year, last_value)
select
  (applicant_number / power(10, char_length(applicant_number::text) - 4)::bigint)::integer,
  count(*)::integer
from public.applicants
group by 1;

alter table public.applicants
  add constraint applicants_applicant_number_format check (applicant_number >= 100001);

create trigger applicants_assign_applicant_number
  before insert on public.applicants
  for each row execute procedure private.assign_applicant_number();

-- The old global sequence is no longer used.
revoke all on sequence public.applicant_number_seq from authenticated;
drop sequence public.applicant_number_seq;

-- Numbers can now be longer than six digits, so format them without padding/truncation:
-- first digit, a dash, then the rest (202601 -> "2-02601").
create or replace function public.format_applicant_number(value bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when value is null then null
    when char_length(value::text) < 6 then substr(lpad(value::text, 6, '0'), 1, 1) || '-' || substr(lpad(value::text, 6, '0'), 2)
    else substr(value::text, 1, 1) || '-' || substr(value::text, 2)
  end
$$;
