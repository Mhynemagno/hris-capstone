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
  3::bigint,
  'Only the three client-provided departments are active'
);

select extensions.is(
  (
    select string_agg(name, ' | ' order by name)
    from public.departments
    where is_active
  ),
  'Administrative & Intelligence Division | Operations Division | Women and Children Protection Desk',
  'Active departments match Departments.txt exactly'
);

select extensions.ok(
  not exists (
    select 1
    from public.departments
    where name = 'Demo Operations'
      and is_active
  ),
  'The former demo department is not active'
);

select * from extensions.finish();

rollback;
