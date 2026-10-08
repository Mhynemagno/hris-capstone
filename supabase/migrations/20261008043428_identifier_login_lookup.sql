-- Identifier-to-email resolution is intentionally callable only by the server's
-- service-role client; browsers never receive an email lookup capability.
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
    if normalized_identifier !~ '^[0-9]{6}$' then return null; end if;
    select profile.email into resolved_email
      from public.applicants applicant
      join public.profiles profile on profile.id = applicant.profile_id
     where applicant.applicant_number = normalized_identifier::bigint;
  elsif target_mode = 'employee' then
    if normalized_identifier = '' then return null; end if;
    select profile.email into resolved_email
      from public.employees employee
      join public.profiles profile on profile.id = employee.profile_id
     where upper(employee.employee_number) = upper(normalized_identifier)
       and employee.employment_status = 'active';
  else
    return null;
  end if;
  return resolved_email;
end;
$$;

revoke all on function public.resolve_login_identifier(text, text) from public, anon, authenticated;
grant execute on function public.resolve_login_identifier(text, text) to service_role;
