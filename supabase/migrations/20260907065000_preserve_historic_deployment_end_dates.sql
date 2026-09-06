create or replace function private.preserve_historic_deployment_end_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ends_on is not null and new.ends_on is null then
    new.ends_on := old.ends_on;
  end if;
  return new;
end;
$$;

create trigger deployments_preserve_historic_end_date
before update on public.deployments
for each row execute procedure private.preserve_historic_deployment_end_date();
