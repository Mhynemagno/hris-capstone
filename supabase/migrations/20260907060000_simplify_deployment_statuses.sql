update public.deployments
set status = case when status = 'active' then 'active' else 'rejected' end;

alter table public.deployments drop constraint deployments_status_check;
alter table public.deployments add constraint deployments_status_check check (status in ('active', 'rejected'));
alter table public.deployments drop constraint deployments_check;

do $$
declare definition text;
begin
  select pg_get_functiondef('private.create_deployment(uuid,text,text,text,text,date,date,text,text)'::regprocedure) into definition;
  definition := replace(definition, '''planned'', ''active'', ''completed'', ''cancelled''', '''active'', ''rejected''');
  execute definition;
  select pg_get_functiondef('private.update_deployment(uuid,timestamptz,text,text,text,text,date,date,text,text)'::regprocedure) into definition;
  definition := replace(definition, '''planned'', ''active'', ''completed'', ''cancelled''', '''active'', ''rejected''');
  execute definition;
end $$;
