-- The dashboard's On Duty card counts everyone who has timed in today, including
-- those who arrived late. A log only becomes present/late once it has a time-out,
-- so a record that is still open ('incomplete') is counted as present or late
-- from its time-in instead of being left out of On Duty.

create or replace function private.attendance_time_in_is_late(target_time_in timestamptz, target_workday_start time, target_grace_minutes integer, target_timezone text)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((target_time_in at time zone target_timezone)::time > target_workday_start + make_interval(mins => target_grace_minutes), false);
$$;

revoke all on function private.attendance_time_in_is_late(timestamptz, time, integer, text) from public, anon, authenticated;

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
      'present', (select count(distinct log.employee_id) from public.attendance_logs log join public.employees employee on employee.id = log.employee_id and employee.employment_status = 'active' left join public.attendance_integration_settings setting on setting.id = log.integration_id
        where log.attendance_date = manila_today and (log.status = 'present' or (log.status = 'incomplete' and not private.attendance_time_in_is_late(log.time_in, setting.workday_start, setting.late_grace_minutes, setting.timezone)))),
      'late', (select count(distinct log.employee_id) from public.attendance_logs log join public.employees employee on employee.id = log.employee_id and employee.employment_status = 'active' left join public.attendance_integration_settings setting on setting.id = log.integration_id
        where log.attendance_date = manila_today and (log.status = 'late' or (log.status = 'incomplete' and private.attendance_time_in_is_late(log.time_in, setting.workday_start, setting.late_grace_minutes, setting.timezone)))),
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

revoke all on function private.get_hr_dashboard_overview() from public, anon, authenticated;
