-- Deleting an account clears the person's name on other people's records (ON DELETE SET NULL). Postgres
-- re-tests every CHECK on each row it updates, including rules added NOT VALID that older rows never met.
-- On the live database an HR account could not be deleted because a promotion criterion it created asks
-- for 5 years of service, from before the 1-3 rule. Like the leave start date (20261012120001), these two
-- rules now apply only when their own fields are saved, so older rows no longer block unrelated updates.

-- Promotion criteria: minimum years of service must be 1 to 3 (20261008190025).
alter table public.promotion_criteria drop constraint promotion_criteria_minimum_years_of_service_1_to_3;

create function private.enforce_promotion_criteria_service_years()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.minimum_years_of_service is distinct from old.minimum_years_of_service)
    and new.minimum_years_of_service not between 1 and 3 then
    raise exception 'new row for relation "promotion_criteria" violates check constraint "promotion_criteria_minimum_years_of_service_1_to_3"'
      using errcode = '23514', constraint = 'promotion_criteria_minimum_years_of_service_1_to_3';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_promotion_criteria_service_years() from public, anon, authenticated;

create trigger promotion_criteria_enforce_service_years
  before insert or update of minimum_years_of_service on public.promotion_criteria
  for each row execute function private.enforce_promotion_criteria_service_years();

-- Applicant profile documents: everything except the 2x2 picture must be a PDF (20261004110000).
alter table public.applicant_profile_documents drop constraint applicant_profile_documents_non_photo_is_pdf;

create function private.enforce_applicant_profile_document_pdf()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or (new.kind, new.mime_type) is distinct from (old.kind, old.mime_type))
    and new.kind <> 'photo' and new.mime_type <> 'application/pdf' then
    raise exception 'new row for relation "applicant_profile_documents" violates check constraint "applicant_profile_documents_non_photo_is_pdf"'
      using errcode = '23514', constraint = 'applicant_profile_documents_non_photo_is_pdf';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_applicant_profile_document_pdf() from public, anon, authenticated;

create trigger applicant_profile_documents_enforce_pdf
  before insert or update of kind, mime_type on public.applicant_profile_documents
  for each row execute function private.enforce_applicant_profile_document_pdf();
