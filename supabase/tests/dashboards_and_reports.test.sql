begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(18);

select extensions.has_schema('reporting', 'Private reporting schema exists');
select extensions.has_function('public', 'get_hr_dashboard_summary', array['date', 'date'], 'HR dashboard RPC exists');
select extensions.has_function('public', 'get_management_dashboard_summary', array['date', 'date'], 'Management dashboard RPC exists');
select extensions.has_function('public', 'get_hr_report', array['text', 'date', 'date', 'bigint', 'text', 'integer', 'integer'], 'HR report RPC exists');
select extensions.has_function('public', 'get_management_report', array['text', 'date', 'date', 'bigint', 'text', 'integer', 'integer'], 'Management report RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001501', 'authenticated', 'authenticated', 'reports-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001502', 'authenticated', 'authenticated', 'reports-management@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001503', 'authenticated', 'authenticated', 'reports-employee@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000001501'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000001502'::uuid then 'management'::public.app_role
  else 'employee'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000001501'::uuid,
  '00000000-0000-4000-8000-000000001502'::uuid,
  '00000000-0000-4000-8000-000000001503'::uuid
);

-- Leave figures on the dashboard (tester feedback): On-Leave counts approved leave covering today,
-- and the Leave status donut shows Approved / Upcoming / Rejected, including leave that starts later.
-- Counts are compared before and after the fixtures so existing local data does not matter.
create temporary table leave_dashboard_dates as
select (now() at time zone 'Asia/Manila')::date as today;

create temporary table leave_dashboard_before as
select private.get_dashboard_chart_data(today - 30, today) as data from leave_dashboard_dates;

create function pg_temp.leave_bucket(chart jsonb, bucket text) returns integer language sql as $$
  select coalesce((select (item ->> 'count')::integer from jsonb_array_elements(chart -> 'breakdowns' -> 'leaveStatus') item where item ->> 'label' = bucket), 0);
$$;

insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000001511', 'DASH-LV-1', 'Today', 'Leave', 'dash-today@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000001512', 'DASH-LV-2', 'Soon', 'Leave', 'dash-soon@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000001513', 'DASH-LV-3', 'Asked', 'Leave', 'dash-asked@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000001514', 'DASH-LV-4', 'Denied', 'Leave', 'dash-denied@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000001515', 'DASH-LV-5', 'Withdrawn', 'Leave', 'dash-withdrawn@example.test', '2024-01-01');

insert into public.leave_types (id, name, requires_attachment, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000001521', 'Dashboard leave test', false, '00000000-0000-4000-8000-000000001501', '00000000-0000-4000-8000-000000001501');

insert into public.leave_requests (id, employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on, reason, status, decision_note, decided_by_user_id, decided_at)
select request.id, request.employee_id, '00000000-0000-4000-8000-000000001503', '00000000-0000-4000-8000-000000001521', 'Dashboard leave test',
  dates.today + request.start_offset, dates.today + request.end_offset, null, request.status,
  case when request.status = 'rejected' then 'Short staffed.' end,
  case when request.status in ('approved', 'rejected') then '00000000-0000-4000-8000-000000001501'::uuid end,
  case when request.status in ('approved', 'rejected') then now() end
from leave_dashboard_dates dates
cross join (values
  ('00000000-0000-4000-8000-000000001531'::uuid, '00000000-0000-4000-8000-000000001511'::uuid, 0, 0, 'approved'),
  ('00000000-0000-4000-8000-000000001532'::uuid, '00000000-0000-4000-8000-000000001512'::uuid, 2, 4, 'approved'),
  ('00000000-0000-4000-8000-000000001533'::uuid, '00000000-0000-4000-8000-000000001513'::uuid, 5, 5, 'pending'),
  ('00000000-0000-4000-8000-000000001534'::uuid, '00000000-0000-4000-8000-000000001514'::uuid, 3, 3, 'rejected'),
  ('00000000-0000-4000-8000-000000001535'::uuid, '00000000-0000-4000-8000-000000001515'::uuid, 0, 1, 'cancelled')
) as request(id, employee_id, start_offset, end_offset, status);

create temporary table leave_dashboard_after as
select private.get_dashboard_chart_data(today - 30, today) as data from leave_dashboard_dates;

select extensions.is(
  ((select data from leave_dashboard_after) -> 'metrics' ->> 'onLeave')::integer - ((select data from leave_dashboard_before) -> 'metrics' ->> 'onLeave')::integer,
  1, 'On-Leave counts personnel on approved leave covering today (not future, pending or cancelled leave)'
);
select extensions.is(
  (select array_agg(item.value ->> 'label' order by item.position) from jsonb_array_elements((select data from leave_dashboard_after) -> 'breakdowns' -> 'leaveStatus') with ordinality as item(value, position) where item.value ->> 'label' in ('approved', 'upcoming', 'rejected')),
  array['approved', 'upcoming', 'rejected'], 'Leave status always lists Approved, Upcoming and Rejected'
);
select extensions.is(
  pg_temp.leave_bucket((select data from leave_dashboard_after), 'approved') - pg_temp.leave_bucket((select data from leave_dashboard_before), 'approved'),
  1, 'Approved leave that has started counts as Approved'
);
select extensions.is(
  pg_temp.leave_bucket((select data from leave_dashboard_after), 'upcoming') - pg_temp.leave_bucket((select data from leave_dashboard_before), 'upcoming'),
  2, 'Approved and pending leave starting after today counts as Upcoming even past the period end'
);
select extensions.is(
  pg_temp.leave_bucket((select data from leave_dashboard_after), 'rejected') - pg_temp.leave_bucket((select data from leave_dashboard_before), 'rejected'),
  1, 'Rejected leave counts as Rejected'
);
select extensions.is(
  (select count(*)::integer from jsonb_array_elements((select data from leave_dashboard_after) -> 'breakdowns' -> 'leaveStatus') item where item ->> 'label' = 'cancelled'),
  0, 'Cancelled leave is left out of the Leave status chart'
);
grant select on leave_dashboard_dates to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001501';
select extensions.ok(
  public.get_hr_dashboard_summary('2026-08-01', '2026-08-31') ? 'metrics',
  'HR receives a fixed dashboard payload'
);
select extensions.ok(
  (select public.get_hr_dashboard_summary(today - 30, today) -> 'breakdowns' -> 'leaveStatus' @> '[{"label": "upcoming"}]'::jsonb from leave_dashboard_dates),
  'HR dashboard returns the Upcoming leave bucket'
);
select extensions.is(
  public.get_hr_report('deployments', '2026-08-01', '2026-08-31', null, null, 1, 25) ->> 'reportKey',
  'deployments', 'HR receives the requested whitelisted report'
);
select extensions.is(
  public.get_hr_report(
    target_report_key => 'deployments',
    target_department_id => null,
    target_status => null,
    target_page => 1,
    target_page_size => 25
  ) ->> 'reportKey',
  'deployments', 'HR report RPC accepts requests that omit optional date filters'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001502';
select extensions.ok(
  public.get_management_report('employee-performance', '2026-08-01', '2026-08-31', null, null, 1, 25) ? 'rows',
  'Management receives a report payload'
);
select extensions.is(
  public.get_management_report(
    target_report_key => 'employee-performance',
    target_department_id => null,
    target_status => null,
    target_page => 1,
    target_page_size => 25
  ) ->> 'reportKey',
  'employee-performance', 'Management report RPC accepts requests that omit optional date filters'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001503';
select extensions.throws_ok(
  $$select public.get_management_dashboard_summary('2026-08-01', '2026-08-31')$$,
  '42501', null, 'Employee cannot call Management dashboard RPC'
);

select * from extensions.finish();

rollback;
