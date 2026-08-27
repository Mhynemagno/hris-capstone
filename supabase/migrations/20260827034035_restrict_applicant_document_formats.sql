create or replace function private.validate_applicant_document_format()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mime_type not in ('application/pdf', 'image/png', 'image/jpeg')
     or new.object_path !~ '\.(pdf|png|jpe?g)$' then
    raise exception 'Invalid application document.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger applicant_documents_validate_format
  before insert or update of mime_type, object_path
  on public.applicant_documents
  for each row execute function private.validate_applicant_document_format();

revoke all on function private.validate_applicant_document_format() from public, anon, authenticated;
