alter table public.attendance_integration_settings
  alter column workday_start set default time '05:00';

update public.attendance_integration_settings
set workday_start = time '05:00', updated_at = now()
where adapter_key = 'csv_xlsx';

create or replace function private.get_hr_dashboard_overview()
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  manila_today date := (now() at time zone 'Asia/Manila')::date;
begin
  perform private.require_active_hr();
  return jsonb_build_object(
    'personnelByRank', coalesce((
      select jsonb_agg(jsonb_build_object('code', grouped.code, 'name', grouped.name, 'count', grouped.total) order by grouped.sort_key desc, grouped.code)
      from (
        select rank.code, rank.name, coalesce(rank.sort_order, -1) as sort_key, count(*) as total
        from public.employees employee
        left join public.ranks rank on rank.id = employee.rank_id
        where employee.employment_status = 'active'
        group by rank.code, rank.name, rank.sort_order
      ) grouped
    ), '[]'::jsonb),
    'personnelByGender', (
      select jsonb_agg(jsonb_build_object('label', bucket.label, 'count', (
        select count(*) from public.employees employee
        where employee.employment_status = 'active' and coalesce(employee.gender, 'unspecified') = bucket.label
      )) order by bucket.sort_key)
      from (values ('male', 1), ('female', 2), ('unspecified', 3)) as bucket(label, sort_key)
    ),
    'attendanceToday', jsonb_build_object(
      'present', (select count(distinct log.employee_id) from public.attendance_logs log join public.employees employee on employee.id = log.employee_id and employee.employment_status = 'active' where log.attendance_date = manila_today and log.status = 'present'),
      'late', (select count(distinct log.employee_id) from public.attendance_logs log join public.employees employee on employee.id = log.employee_id and employee.employment_status = 'active' where log.attendance_date = manila_today and log.status = 'late'),
      'incomplete', (select count(distinct log.employee_id) from public.attendance_logs log join public.employees employee on employee.id = log.employee_id and employee.employment_status = 'active' where log.attendance_date = manila_today and log.status = 'incomplete'),
      'onLeave', (select count(*) from public.employees employee where employee.employment_status = 'active'
        and exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = employee.id and leave_request.status = 'approved' and manila_today between leave_request.starts_on and leave_request.ends_on)),
      'absent', (select count(distinct log.employee_id) from public.attendance_logs log join public.employees employee on employee.id = log.employee_id and employee.employment_status = 'active' where log.attendance_date = manila_today and log.status = 'absent'
          and not exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = employee.id and leave_request.status = 'approved' and manila_today between leave_request.starts_on and leave_request.ends_on))
        + (select count(*) from public.employees employee where employee.employment_status = 'active'
        and exists (select 1 from public.attendance_logs scanned where scanned.attendance_date = manila_today)
        and (employee.employment_started_on is null or employee.employment_started_on <= manila_today)
        and not exists (select 1 from public.attendance_logs log where log.employee_id = employee.id and log.attendance_date = manila_today)
        and not exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = employee.id and leave_request.status = 'approved' and manila_today between leave_request.starts_on and leave_request.ends_on))
    )
  );
end;
$$;

create or replace function public.get_hr_dashboard_overview()
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  return private.get_hr_dashboard_overview();
end;
$$;

revoke all on function private.get_hr_dashboard_overview() from public, anon, authenticated;
revoke all on function public.get_hr_dashboard_overview() from public, anon;
grant execute on function public.get_hr_dashboard_overview() to authenticated;
