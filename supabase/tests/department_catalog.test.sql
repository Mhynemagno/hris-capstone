begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(3);

select extensions.is(
  (
    select count(*)
    from public.departments
    where is_active
  ),
  9::bigint,
  'Only the nine client-provided departments are active'
);

select extensions.is(
  (
    select string_agg(name, ' | ' order by name)
    from public.departments
    where is_active
  ),
  'Drug Enforcement Unit | Intelligence Section | Police Community Precincts / Sub-Stations | '
    || 'Station Administrative and Resource Management Section | Station Investigation and Detective Management Section | '
    || 'Station Warrant and Subpoena Section | Tactical Operations Center | Traffic and Investigation Unit | '
    || 'Women and Children Protection Desk',
  'Active departments match the client department list exactly'
);

select extensions.is(
  (select count(*) from public.departments),
  9::bigint,
  'No former departments remain after the reset'
);

select * from extensions.finish();

rollback;
