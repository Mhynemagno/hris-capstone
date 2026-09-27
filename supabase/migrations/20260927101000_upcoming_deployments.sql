-- Deployments created in advance (tester feedback): a deployment whose start date is still in the
-- future is "Upcoming", not deployed now. The stored status stays 'active'; the app derives
-- "Upcoming" at read time (start date after today in Asia/Manila), so it flips to "Active" on the
-- start date with no scheduled job.
--
-- The dashboard "Deployments — personnel deployed now" tile counted every status = 'active' row,
-- including upcoming ones. Patch only that expression in the current definitions of the HR and
-- management dashboard summaries, leaving the rest of each function as it is.

do $$
declare
  target regprocedure;
  definition text;
  old_expression constant text := $expr$(select count(*) from public.deployments where status = 'active')$expr$;
  new_expression constant text := $expr$(select count(*) from public.deployments where status = 'active' and starts_on <= (now() at time zone 'Asia/Manila')::date)$expr$;
begin
  foreach target in array array[
    'private.get_hr_dashboard_summary(date,date)'::regprocedure,
    'private.get_management_dashboard_summary(date,date)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    if position(old_expression in definition) = 0 then
      raise exception 'Expected active deployment count not found in %', target;
    end if;
    execute replace(definition, old_expression, new_expression);
  end loop;
end $$;
