-- Dashboard leave figures (2026-09-27, tester feedback):
--   onLeave:     personnel on an APPROVED leave request that covers today (Asia/Manila date),
--                plus anyone whose employment status is still set to on_leave by HR. Previously only
--                the employment status was counted, so an approved leave for today did not show.
--   leaveStatus: the donut now always shows Approved, Upcoming and Rejected (Pending appears only
--                when some pending leave has already started, so no request is hidden):
--                  upcoming = approved or pending leave that starts after today (Manila date);
--                  approved = approved leave that has already started (today or earlier);
--                  pending  = pending leave that has already started;
--                  rejected = rejected leave.
--                Cancelled requests are left out. A request is counted when its dates overlap the
--                reporting period, or when it starts after today, so future leave is no longer hidden
--                by a period that ends today.
-- Every other metric and breakdown is unchanged. Signature, security definer, search_path and the
-- revoke are the same; the helper is still only reached through the role-checked summary functions.

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
      'attendanceStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.attendance_logs where attendance_date between target_starts_on and target_ends_on group by status) attendance), '[]'::jsonb),
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
