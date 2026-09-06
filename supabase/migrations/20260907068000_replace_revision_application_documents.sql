create or replace function private.replace_revision_application_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'Needs Revision' and new.status = 'Under Review' then
    delete from public.applicant_documents where application_id = old.id;
  end if;
  return new;
end;
$$;

create trigger applications_replace_revision_documents
before update of status on public.applications
for each row execute procedure private.replace_revision_application_documents();
