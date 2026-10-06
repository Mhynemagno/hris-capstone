-- Dashboard "Attendance status" donut (client feedback, 2026-10-07):
--   * Absent is now counted, not only taken from logs. Face scans never write an "absent" log, so the
--     donut never showed Absent. On every day in the period (up to today, Manila date) when the scanner
--     recorded at least one log, each active employee already in service (employment_started_on on or
--     before that day) with no attendance log and no approved leave covering that day counts as absent.
--     Days nobody scanned (weekends, days before go-live) are skipped so they do not flood the count.
--     Absences recorded by hand (status = 'absent' logs) still count too.
--   * The donut always lists Present, Late, Incomplete (shown as "Partial") and Absent, in that order.
-- Every other metric and breakdown is unchanged from 20260927160100. Signature, security definer,
-- search_path and the revoke are the same.

create or replace function private.get_dashboard_chart_data(target_starts_on date, target_ends_on date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  manila_today date := (now() at time zone 'Asia/Manila')::date;
begin
  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalPersonnel', (select count(*) from reporting.current_workforce),
      'onLeave', (select count(*) from reporting.current_workforce workforce where workforce.employment_status = 'on_leave' or exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = workforce.id and leave_request.status = 'approved' and manila_today between leave_request.starts_on and leave_request.ends_on)),
      'openJobs', (select count(*) from public.job_openings where status = 'published'),
      'hiredApplicants', (select count(*) from public.applications where status = 'Hired' and submitted_at::date between target_starts_on and target_ends_on),
      'attendanceToday', (select count(*) from public.attendance_logs where attendance_date = current_date and status in ('present', 'late')),
      'departments', (select count(*) from public.departments where is_active),
      'applicants', (select count(distinct user_id) from public.user_roles where role = 'applicant'::public.app_role)
    ),
    'breakdowns', jsonb_build_object(
      'workforceByDepartment', coalesce((select jsonb_agg(jsonb_build_object('label', department_name, 'count', total) order by total desc, department_name) from (select coalesce(department.name, 'Unassigned') as department_name, count(*) as total from reporting.current_workforce workforce left join public.departments department on department.id = workforce.department_id where workforce.employment_status = 'active' group by department_name) workforce_department), '[]'::jsonb),
      'workforceByRank', coalesce((select jsonb_agg(jsonb_build_object('label', rank_label, 'count', total) order by sort_key, rank_label) from (select coalesce(rank.code, 'Unassigned') as rank_label, coalesce(rank.sort_order, 2147483647) as sort_key, count(*) as total from reporting.current_workforce workforce left join public.ranks rank on rank.id = workforce.rank_id group by rank.code, rank.sort_order) workforce_rank), '[]'::jsonb),
      'attendanceStatus', (
        with scanned_day as (
          select distinct attendance_date as day
          from public.attendance_logs
          where attendance_date between target_starts_on and least(target_ends_on, manila_today)
        ),
        counted as (
          select status as label, count(*) as total
          from public.attendance_logs
          where attendance_date between target_starts_on and target_ends_on
          group by status
          union all
          select 'absent', count(*)
          from scanned_day
          join public.employees employee
            on employee.employment_status = 'active'
           and (employee.employment_started_on is null or employee.employment_started_on <= scanned_day.day)
          where not exists (select 1 from public.attendance_logs log where log.employee_id = employee.id and log.attendance_date = scanned_day.day)
            and not exists (select 1 from public.leave_requests leave_request where leave_request.employee_id = employee.id and leave_request.status = 'approved' and scanned_day.day between leave_request.starts_on and leave_request.ends_on)
        )
        select jsonb_agg(jsonb_build_object('label', bucket.label, 'count', coalesce((select sum(counted.total) from counted where counted.label = bucket.label), 0)::integer) order by bucket.sort_key)
        from (values ('present', 1), ('late', 2), ('incomplete', 3), ('absent', 4)) as bucket(label, sort_key)
      ),
      'attendanceTrend', (select jsonb_agg(jsonb_build_object('label', day::date, 'count', (select count(*) from public.attendance_logs where attendance_date = day::date and status in ('present', 'late'))) order by day) from generate_series(greatest(target_starts_on, target_ends_on - 29), target_ends_on, interval '1 day') as day),
      'leaveStatus', (
        select jsonb_agg(jsonb_build_object('label', bucket.label, 'count', coalesce(counted.total, 0)) order by bucket.sort_key)
        from (values ('approved', 1, true), ('upcoming', 2, true), ('pending', 3, false), ('rejected', 4, true)) as bucket(label, sort_key, always_shown)
        left join (
          select
            case
              when leave_request.status = 'rejected' then 'rejected'
              when leave_request.starts_on > manila_today then 'upcoming'
              else leave_request.status
            end as label,
            count(*) as total
          from public.leave_requests leave_request
          where leave_request.status in ('approved', 'pending', 'rejected')
            and (
              (leave_request.starts_on <= target_ends_on and leave_request.ends_on >= target_starts_on)
              or leave_request.starts_on > manila_today
            )
          group by 1
        ) counted on counted.label = bucket.label
        where bucket.always_shown or coalesce(counted.total, 0) > 0
      ),
      'leaveByType', coalesce((select jsonb_agg(jsonb_build_object('label', leave_type_name, 'count', total) order by total desc, leave_type_name) from (select leave_type_name, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on group by leave_type_name) leave_type), '[]'::jsonb),
      'promotionReadiness', coalesce((select jsonb_agg(jsonb_build_object('label', readiness, 'count', total) order by readiness desc) from (select case when is_ready then 'Ready' else 'Not ready' end as readiness, count(*) as total from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on group by is_ready) readiness_counts), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function private.get_dashboard_chart_data(date, date) from public, anon, authenticated;
