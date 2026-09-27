-- Applicant registration now collects mobile number, middle name, qualifier, and birthdate.
-- The sign-up metadata is copied into the existing applicants columns when the Auth user is
-- created. Each value is sanitized here so malformed metadata never blocks the sign-up itself:
-- anything that does not fit the column contract is stored as null (the applicant can fill it
-- in later from their profile).

create or replace function private.applicant_metadata_birthdate(raw_value text)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  parsed date;
begin
  if raw_value is null or raw_value !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  begin
    parsed := raw_value::date;
  exception when others then
    return null;
  end;
  return parsed;
end;
$$;

revoke all on function private.applicant_metadata_birthdate(text) from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  middle_name_value text := nullif(btrim(metadata ->> 'middle_name'), '');
  qualifier_value text := nullif(btrim(metadata ->> 'qualifier'), '');
  phone_value text := nullif(btrim(metadata ->> 'phone'), '');
  birthdate_value date := private.applicant_metadata_birthdate(nullif(btrim(metadata ->> 'date_of_birth'), ''));
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(metadata ->> 'full_name', metadata ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'applicant'::public.app_role)
  on conflict (user_id) do nothing;

  if nullif(btrim(metadata ->> 'first_name'), '') is not null
     and nullif(btrim(metadata ->> 'last_name'), '') is not null then
    insert into public.applicants (profile_id, first_name, last_name, middle_name, qualifier, phone, date_of_birth)
    values (
      new.id,
      btrim(metadata ->> 'first_name'),
      btrim(metadata ->> 'last_name'),
      case when char_length(middle_name_value) <= 80 then middle_name_value end,
      case when qualifier_value in ('Jr.', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX') then qualifier_value end,
      case when phone_value ~ '^\+639[0-9]{9}$' then phone_value end,
      case when birthdate_value < current_date then birthdate_value end
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;
