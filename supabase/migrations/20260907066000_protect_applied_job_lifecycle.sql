create or replace function private.protect_applied_job_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    and new.status <> 'closed'
    and exists (select 1 from public.applications application where application.job_opening_id = old.id) then
    raise exception 'Openings with applications can only be withdrawn.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger job_openings_protect_applied_lifecycle
before update of status on public.job_openings
for each row execute procedure private.protect_applied_job_lifecycle();
