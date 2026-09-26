-- Dashboard charts (2026-09-26): both role dashboards gain the headline counts and breakdowns the
-- new chart layout needs. Every existing metric and breakdown key is kept with the same meaning;
-- the new ones come from one shared helper so HR and management always agree.
-- Access rules are unchanged: each public RPC still calls its private function, which checks the
-- caller's active reporting role before anything is read.

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
      'attendanceToday', (select count(*) from public.attendance_logs where attendance_date = current_date and status in ('present', 'late'))
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

create or replace function private.get_hr_dashboard_summary(target_starts_on date, target_ends_on date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  chart_data jsonb;
begin
  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on);
  chart_data := private.get_dashboard_chart_data(target_starts_on, target_ends_on);

  return jsonb_build_object(
    'generatedAt', now(),
    'range', jsonb_build_object('startsOn', target_starts_on, 'endsOn', target_ends_on),
    'metrics', jsonb_build_object(
      'activeWorkforce', (select count(*) from reporting.current_workforce where employment_status = 'active'),
      'activeDeployments', (select count(*) from public.deployments where status = 'active'),
      'recruitmentApplications', (select count(*) from public.applications where submitted_at::date between target_starts_on and target_ends_on),
      'attendanceExceptions', (select count(*) from public.attendance_logs where attendance_date between target_starts_on and target_ends_on and status in ('late', 'absent', 'incomplete')),
      'pendingLeave', (select count(*) from public.leave_requests where status = 'pending'),
      'promotionReady', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and is_ready),
      'trainingNeeds', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and jsonb_array_length(missing_requirements) > 0)
    ) || (chart_data -> 'metrics'),
    'breakdowns', jsonb_build_object(
      'recruitmentPipeline', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.applications where submitted_at::date between target_starts_on and target_ends_on group by status) pipeline), '[]'::jsonb),
      'deploymentStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.deployments group by status) deployment), '[]'::jsonb)
    ) || (chart_data -> 'breakdowns')
  );
end;
$$;

create or replace function private.get_management_dashboard_summary(target_starts_on date, target_ends_on date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  chart_data jsonb;
begin
  perform private.require_active_reporting_role(array['management'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on);
  chart_data := private.get_dashboard_chart_data(target_starts_on, target_ends_on);

  return jsonb_build_object(
    'generatedAt', now(),
    'range', jsonb_build_object('startsOn', target_starts_on, 'endsOn', target_ends_on),
    'metrics', jsonb_build_object(
      'activeWorkforce', (select count(*) from reporting.current_workforce where employment_status = 'active'),
      'activeDeployments', (select count(*) from public.deployments where status = 'active'),
      'recruitmentApplications', (select count(*) from public.applications where submitted_at::date between target_starts_on and target_ends_on),
      'attendanceExceptions', (select count(*) from public.attendance_logs where attendance_date between target_starts_on and target_ends_on and status in ('late', 'absent', 'incomplete')),
      'pendingLeave', (select count(*) from public.leave_requests where status = 'pending'),
      'promotionReady', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and is_ready),
      'trainingNeeds', (select count(*) from public.promotion_evaluations where evaluated_on between target_starts_on and target_ends_on and jsonb_array_length(missing_requirements) > 0)
    ) || (chart_data -> 'metrics'),
    'breakdowns', jsonb_build_object(
      'recruitmentPipeline', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.applications where submitted_at::date between target_starts_on and target_ends_on group by status) pipeline), '[]'::jsonb),
      'deploymentStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.deployments group by status) deployment), '[]'::jsonb),
      'attendanceLeaveExceptions', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', total) order by label) from (select status as label, count(*) as total from public.attendance_logs where attendance_date between target_starts_on and target_ends_on and status in ('late', 'absent', 'incomplete') group by status union all select status as label, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on and status = 'pending' group by status) exception_counts), '[]'::jsonb)
    ) || (chart_data -> 'breakdowns')
  );
end;
$$;
