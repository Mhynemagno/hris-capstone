-- Final Revisions follow-up: preserve scorecard reports while correcting Leave output.
alter function private.get_hr_report(text, date, date, bigint, text, integer, integer)
  rename to get_hr_report_with_scorecard;

create function private.get_hr_report(
  target_report_key text,
  target_starts_on date,
  target_ends_on date,
  target_department_id bigint,
  target_status text,
  target_page integer,
  target_page_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  page_offset integer := (target_page - 1) * target_page_size;
begin
  if target_report_key <> 'leave' then
    return private.get_hr_report_with_scorecard(
      target_report_key,
      target_starts_on,
      target_ends_on,
      target_department_id,
      target_status,
      target_page,
      target_page_size
    );
  end if;

  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on, target_page, target_page_size);

  with filtered as (
    select
      row_number() over (order by leave_request.starts_on desc, employee.employee_number, leave_request.id) as number,
      employee.employee_number,
      concat_ws(' ', employee.first_name, employee.last_name) as employee,
      rank.code as rank,
      leave_request.status,
      leave_type.name as leave_type
    from public.leave_requests leave_request
    join public.employees employee on employee.id = leave_request.employee_id
    left join public.ranks rank on rank.id = employee.rank_id
    join public.leave_types leave_type on leave_type.id = leave_request.leave_type_id
    where leave_request.starts_on between target_starts_on and target_ends_on
      and (target_department_id is null or employee.department_id = target_department_id)
      and (target_status is null or leave_request.status = target_status)
  ), paged as (
    select *
    from filtered
    order by number
    limit target_page_size offset page_offset
  )
  select jsonb_build_object(
    'reportKey', target_report_key,
    'title', 'Leave',
    'generatedAt', now(),
    'columns', jsonb_build_array(
      jsonb_build_object('key', 'number', 'label', 'Number'),
      jsonb_build_object('key', 'rank', 'label', 'Rank'),
      jsonb_build_object('key', 'employee', 'label', 'Name'),
      jsonb_build_object('key', 'employeeNumber', 'label', 'Badge Number'),
      jsonb_build_object('key', 'leaveType', 'label', 'Leave Type'),
      jsonb_build_object('key', 'status', 'label', 'Status')
    ),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'number', number,
        'rank', rank,
        'employee', employee,
        'employeeNumber', employee_number,
        'leaveType', leave_type,
        'status', status
      ) order by number)
      from paged
    ), '[]'::jsonb),
    'totalCount', (select count(*) from filtered),
    'page', target_page,
    'pageSize', target_page_size
  ) into result;

  return result;
end;
$$;

revoke all on function private.get_hr_report_with_scorecard(text, date, date, bigint, text, integer, integer) from public, anon, authenticated;
revoke all on function private.get_hr_report(text, date, date, bigint, text, integer, integer) from public, anon, authenticated;
