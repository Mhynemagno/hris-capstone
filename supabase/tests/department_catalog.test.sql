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
  8::bigint,
  'Only the eight client-provided units / sections are active'
);

select extensions.is(
  (
    select string_agg(name, ' | ' order by name)
    from public.departments
    where is_active
  ),
  'Administrative and Resource Management Section (SARMS) | Deputy Chief of Police for Administration | '
    || 'Deputy Chief of Police for Operations | Investigation and Detective Management Section (SIDMS) | '
    || 'Office of the Chief of Police | Police Community Precinct / Sub-Stations | Traffic and Investigation Section | Women and Children Protection Desk (WCPD)',
  'Active units / sections match the client list exactly'
);

select extensions.is(
  (select count(*) from public.departments where not is_active),
  5::bigint,
  'Former departments that were not renamed are kept, inactive'
);

select * from extensions.finish();

rollback;
