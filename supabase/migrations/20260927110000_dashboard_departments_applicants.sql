-- Dashboard KPI tiles (2026-09-27): the HR/management dashboards now show Departments and Applicants.
-- Adds two metrics to the shared chart helper; every existing metric and breakdown key is kept.
--   departments: active departments in the catalogue (departments.is_active).
--   applicants:  applicant accounts (user_roles.role = 'applicant'; one role per user).
-- Access rules are unchanged: the helper stays private and is only reached through the role-checked
-- dashboard summary functions.

create or replace function private.get_dashboard_chart_data(target_starts_on date, target_ends_on date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalPersonnel', (select count(*) from reporting.current_workforce),
      'onLeave', (select count(*) from reporting.current_workforce where employment_status = 'on_leave'),
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
      'leaveStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on group by status) leave_request), '[]'::jsonb),
      'leaveByType', coalesce((select jsonb_agg(jsonb_build_object('label', leave_type_name, 'count', total) order by total desc, leave_type_name) from (select leave_type_name, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on group by leave_type_name) leave_type), '[]'::jsonb),
      'promotionReadiness', coalesce((select jsonb_agg(jsonb_build_object('label', readiness, 'count', total) order by readiness desc) from (select case when is_ready then 'Ready' else 'Not ready' end as readiness, count(*) as total from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on group by is_ready) readiness_counts), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function private.get_dashboard_chart_data(date, date) from public, anon, authenticated;
