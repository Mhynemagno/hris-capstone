-- Capstone UI HR dashboard (dashboard.html): rank and gender distribution and today's attendance split.
-- ranks.sort_order runs from Patrolman (lowest) upwards, so ranks are listed in descending order; unranked personnel come last.
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
      'present', (select count(*) from public.attendance_logs where attendance_date = manila_today and status = 'present'),
      'late', (select count(*) from public.attendance_logs where attendance_date = manila_today and status = 'late'),
      'incomplete', (select count(*) from public.attendance_logs where attendance_date = manila_today and status = 'incomplete'),
      'onLeave', (select count(*) from public.employees employee where employee.employment_status = 'active'
        and exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = employee.id and leave_request.status = 'approved' and manila_today between leave_request.starts_on and leave_request.ends_on)),
      'absent', (select count(*) from public.employees employee where employee.employment_status = 'active'
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
