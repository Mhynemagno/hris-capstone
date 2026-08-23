create schema reporting;
revoke all on schema reporting from public, anon, authenticated;

create view reporting.current_workforce as
select employee.id, employee.department_id, employee.position_id, employee.employment_status
from public.employees employee;

create or replace function private.require_active_reporting_role(allowed_roles public.app_role[])
returns public.app_role
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role public.app_role;
begin
  select user_role.role into caller_role
  from public.user_roles user_role
  join public.profiles profile on profile.id = user_role.user_id
  where user_role.user_id = caller_id
    and profile.is_active;

  if caller_role is null or not (caller_role = any (allowed_roles)) then
    raise exception 'Reporting access is required.' using errcode = '42501';
  end if;

  return caller_role;
end;
$$;

create or replace function private.validate_reporting_range(target_starts_on date, target_ends_on date, target_page integer default null, target_page_size integer default null)
returns void
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if target_starts_on is null or target_ends_on is null or target_starts_on > target_ends_on then
    raise exception 'Choose a valid inclusive reporting date range.' using errcode = '22007';
  end if;
  if target_page is not null and target_page < 1 then
    raise exception 'Report page must be positive.' using errcode = '22023';
  end if;
  if target_page_size is not null and target_page_size not between 1 and 100 then
    raise exception 'Report page size must be between 1 and 100.' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.get_hr_dashboard_summary(target_starts_on date, target_ends_on date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on);

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
    ),
    'breakdowns', jsonb_build_object(
      'recruitmentPipeline', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.applications where submitted_at::date between target_starts_on and target_ends_on group by status) pipeline), '[]'::jsonb),
      'deploymentStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.deployments group by status) deployment), '[]'::jsonb),
      'attendanceStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.attendance_logs where attendance_date between target_starts_on and target_ends_on group by status) attendance), '[]'::jsonb),
      'leaveStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on group by status) leave_request), '[]'::jsonb)
    )
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
begin
  perform private.require_active_reporting_role(array['management'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on);

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
    ),
    'breakdowns', jsonb_build_object(
      'workforceByDepartment', coalesce((select jsonb_agg(jsonb_build_object('label', department_name, 'count', total) order by department_name) from (select coalesce(department.name, 'Unassigned') as department_name, count(*) as total from reporting.current_workforce workforce left join public.departments department on department.id = workforce.department_id where workforce.employment_status = 'active' group by department_name) workforce_department), '[]'::jsonb),
      'recruitmentPipeline', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.applications where submitted_at::date between target_starts_on and target_ends_on group by status) pipeline), '[]'::jsonb),
      'deploymentStatus', coalesce((select jsonb_agg(jsonb_build_object('label', status, 'count', total) order by status) from (select status, count(*) as total from public.deployments group by status) deployment), '[]'::jsonb),
      'attendanceLeaveExceptions', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', total) order by label) from (select status as label, count(*) as total from public.attendance_logs where attendance_date between target_starts_on and target_ends_on and status in ('late', 'absent', 'incomplete') group by status union all select status as label, count(*) as total from public.leave_requests where starts_on between target_starts_on and target_ends_on and status = 'pending' group by status) exception_counts), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function private.get_hr_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  page_offset integer := (target_page - 1) * target_page_size;
begin
  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on, target_page, target_page_size);

  if target_report_key = 'applicant-tracking' then
    with filtered as (
      select application.id, applicant.first_name, applicant.last_name, opening.title, department.name as department_name, application.status, application.submitted_at
      from public.applications application join public.applicants applicant on applicant.id = application.applicant_id join public.job_openings opening on opening.id = application.job_opening_id left join public.departments department on department.id = opening.department_id
      where application.submitted_at::date between target_starts_on and target_ends_on and (target_department_id is null or opening.department_id = target_department_id) and (target_status is null or application.status = target_status)
    ), paged as (select * from filtered order by submitted_at desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Applicant tracking', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','applicationId','label','Application ID'), jsonb_build_object('key','applicant','label','Applicant'), jsonb_build_object('key','jobTitle','label','Job opening'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','submittedOn','label','Submitted')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('applicationId', id, 'applicant', concat_ws(' ', first_name, last_name), 'jobTitle', title, 'department', department_name, 'status', status, 'submittedOn', submitted_at::date) order by submitted_at desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'hiring-decisions' then
    with filtered as (
      select application.id, applicant.first_name, applicant.last_name, opening.title, department.name as department_name, application.status, application.updated_at
      from public.applications application join public.applicants applicant on applicant.id = application.applicant_id join public.job_openings opening on opening.id = application.job_opening_id left join public.departments department on department.id = opening.department_id
      where application.updated_at::date between target_starts_on and target_ends_on and application.status in ('Hired', 'Not Selected') and (target_department_id is null or opening.department_id = target_department_id) and (target_status is null or application.status = target_status)
    ), paged as (select * from filtered order by updated_at desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Hiring decisions', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','applicationId','label','Application ID'), jsonb_build_object('key','applicant','label','Applicant'), jsonb_build_object('key','jobTitle','label','Job opening'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','decision','label','Decision'), jsonb_build_object('key','decidedOn','label','Decided')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('applicationId', id, 'applicant', concat_ws(' ', first_name, last_name), 'jobTitle', title, 'department', department_name, 'decision', status, 'decidedOn', updated_at::date) order by updated_at desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'employee-performance' then
    with filtered as (
      select employee.id, employee.employee_number, employee.first_name, employee.last_name, department.name as department_name, position.title as position_title, employee.employment_status, rating.rating, rating.review_period_ends_on
      from public.employees employee left join public.departments department on department.id = employee.department_id left join public.positions position on position.id = employee.position_id left join lateral (select performance.rating, performance.review_period_ends_on from public.performance_ratings performance where performance.employee_id = employee.id and performance.review_period_ends_on between target_starts_on and target_ends_on order by performance.review_period_ends_on desc limit 1) rating on true
      where (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or employee.employment_status = target_status)
    ), paged as (select * from filtered order by employee_number limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Employee performance', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','position','label','Position'), jsonb_build_object('key','employmentStatus','label','Employment status'), jsonb_build_object('key','latestRating','label','Latest rating')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', concat_ws(' ', first_name, last_name), 'department', department_name, 'position', position_title, 'employmentStatus', employment_status, 'latestRating', rating) order by employee_number) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'deployments' then
    with filtered as (
      select deployment.id, employee.employee_number, employee.first_name, employee.last_name, department.name as department_name, deployment.assignment_role, deployment.location, deployment.unit, deployment.project, deployment.status, deployment.starts_on, deployment.ends_on
      from public.deployments deployment join public.employees employee on employee.id = deployment.employee_id left join public.departments department on department.id = employee.department_id
      where deployment.starts_on <= target_ends_on and (deployment.ends_on is null or deployment.ends_on >= target_starts_on) and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or deployment.status = target_status)
    ), paged as (select * from filtered order by starts_on desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Deployments', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','assignmentRole','label','Assignment role'), jsonb_build_object('key','destination','label','Destination'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','startsOn','label','Starts'), jsonb_build_object('key','endsOn','label','Ends')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', concat_ws(' ', first_name, last_name), 'department', department_name, 'assignmentRole', assignment_role, 'destination', concat_ws(' · ', location, unit, project), 'status', status, 'startsOn', starts_on, 'endsOn', ends_on) order by starts_on desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'attendance-leave' then
    with filtered as (
      select attendance.employee_id, employee.employee_number, concat_ws(' ', employee.first_name, employee.last_name) as employee_name, employee.department_id, department.name as department_name, 'Attendance'::text as record_type, attendance.status, attendance.attendance_date as record_date from public.attendance_logs attendance join public.employees employee on employee.id = attendance.employee_id left join public.departments department on department.id = employee.department_id where attendance.attendance_date between target_starts_on and target_ends_on
      union all
      select leave_request.employee_id, employee.employee_number, concat_ws(' ', employee.first_name, employee.last_name), employee.department_id, department.name, 'Leave'::text, leave_request.status, leave_request.starts_on from public.leave_requests leave_request join public.employees employee on employee.id = leave_request.employee_id left join public.departments department on department.id = employee.department_id where leave_request.starts_on between target_starts_on and target_ends_on
    ), scoped as (select * from filtered where (target_department_id is null or department_id = target_department_id) and (target_status is null or status = target_status)), paged as (select * from scoped order by record_date desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Attendance and leave', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','recordType','label','Record type'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','date','label','Date')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', employee_name, 'department', department_name, 'recordType', record_type, 'status', status, 'date', record_date) order by record_date desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from scoped), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'promotion-training-needs' then
    with filtered as (
      select evaluation.id, employee.employee_number, employee.first_name, employee.last_name, department.name as department_name, position.title as position_title, evaluation.is_ready, evaluation.recommendation, evaluation.missing_requirements, evaluation.evaluated_on from public.promotion_evaluations evaluation join public.employees employee on employee.id = evaluation.employee_id left join public.departments department on department.id = employee.department_id join public.positions position on position.id = evaluation.target_position_id where evaluation.evaluated_on between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or evaluation.recommendation = target_status)
    ), paged as (select * from filtered order by evaluated_on desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Promotion and training needs', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','employeeNumber','label','Employee number'), jsonb_build_object('key','employee','label','Employee'), jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','targetPosition','label','Target position'), jsonb_build_object('key','ready','label','Ready'), jsonb_build_object('key','recommendation','label','Recommendation'), jsonb_build_object('key','missingRequirements','label','Missing requirements')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('employeeNumber', employee_number, 'employee', concat_ws(' ', first_name, last_name), 'department', department_name, 'targetPosition', position_title, 'ready', is_ready, 'recommendation', recommendation, 'missingRequirements', (select string_agg(value, '; ') from jsonb_array_elements_text(missing_requirements) as requirement(value))) order by evaluated_on desc) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  else
    raise exception 'Unknown report key.' using errcode = '22023';
  end if;

  return result;
end;
$$;

create or replace function private.get_management_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  result jsonb;
  page_offset integer := (target_page - 1) * target_page_size;
begin
  perform private.require_active_reporting_role(array['management'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on, target_page, target_page_size);

  if target_report_key in ('applicant-tracking', 'hiring-decisions') then
    with filtered as (select application.status, count(*) as total from public.applications application join public.job_openings opening on opening.id = application.job_opening_id where application.submitted_at::date between target_starts_on and target_ends_on and (target_department_id is null or opening.department_id = target_department_id) and (target_status is null or application.status = target_status) and (target_report_key <> 'hiring-decisions' or application.status in ('Hired', 'Not Selected')) group by application.status), paged as (select * from filtered order by status limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', case when target_report_key = 'applicant-tracking' then 'Applicant tracking summary' else 'Hiring decisions summary' end, 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','count','label','Applications')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', total) order by status) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'employee-performance' then
    with filtered as (select coalesce(department.name, 'Unassigned') as department_name, count(employee.id) as employee_count, avg(rating.rating) as average_rating from public.employees employee left join public.departments department on department.id = employee.department_id left join lateral (select performance.rating from public.performance_ratings performance where performance.employee_id = employee.id and performance.review_period_ends_on between target_starts_on and target_ends_on order by performance.review_period_ends_on desc limit 1) rating on true where (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or employee.employment_status = target_status) group by department_name), paged as (select * from filtered order by department_name limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Employee performance summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','employeeCount','label','Employees'), jsonb_build_object('key','averageRating','label','Average rating')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('department', department_name, 'employeeCount', employee_count, 'averageRating', average_rating) order by department_name) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'deployments' then
    with filtered as (select coalesce(department.name, 'Unassigned') as department_name, deployment.status, count(*) as total from public.deployments deployment join public.employees employee on employee.id = deployment.employee_id left join public.departments department on department.id = employee.department_id where deployment.starts_on <= target_ends_on and (deployment.ends_on is null or deployment.ends_on >= target_starts_on) and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or deployment.status = target_status) group by department_name, deployment.status), paged as (select * from filtered order by department_name, status limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Deployment summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','count','label','Deployments')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('department', department_name, 'status', status, 'count', total) order by department_name, status) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'attendance-leave' then
    with filtered as (select 'Attendance'::text as record_type, attendance.status, count(*) as total from public.attendance_logs attendance join public.employees employee on employee.id = attendance.employee_id where attendance.attendance_date between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or attendance.status = target_status) group by attendance.status union all select 'Leave'::text, leave_request.status, count(*) from public.leave_requests leave_request join public.employees employee on employee.id = leave_request.employee_id where leave_request.starts_on between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or leave_request.status = target_status) group by leave_request.status), paged as (select * from filtered order by record_type, status limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Attendance and leave summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','recordType','label','Record type'), jsonb_build_object('key','status','label','Status'), jsonb_build_object('key','count','label','Records')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('recordType', record_type, 'status', status, 'count', total) order by record_type, status) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  elsif target_report_key = 'promotion-training-needs' then
    with filtered as (select coalesce(department.name, 'Unassigned') as department_name, evaluation.recommendation, evaluation.is_ready, count(*) as total from public.promotion_evaluations evaluation join public.employees employee on employee.id = evaluation.employee_id left join public.departments department on department.id = employee.department_id where evaluation.evaluated_on between target_starts_on and target_ends_on and (target_department_id is null or employee.department_id = target_department_id) and (target_status is null or evaluation.recommendation = target_status) group by department_name, evaluation.recommendation, evaluation.is_ready), paged as (select * from filtered order by department_name, recommendation limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey', target_report_key, 'title', 'Promotion and training needs summary', 'generatedAt', now(), 'columns', jsonb_build_array(jsonb_build_object('key','department','label','Department'), jsonb_build_object('key','recommendation','label','Recommendation'), jsonb_build_object('key','ready','label','Ready'), jsonb_build_object('key','count','label','Evaluations')), 'rows', coalesce((select jsonb_agg(jsonb_build_object('department', department_name, 'recommendation', recommendation, 'ready', is_ready, 'count', total) order by department_name, recommendation) from paged), '[]'::jsonb), 'totalCount', (select count(*) from filtered), 'page', target_page, 'pageSize', target_page_size) into result;
  else
    raise exception 'Unknown report key.' using errcode = '22023';
  end if;

  return result;
end;
$$;

create or replace function public.get_hr_dashboard_summary(target_starts_on date, target_ends_on date)
returns jsonb language plpgsql security definer stable set search_path = '' as $$ begin return private.get_hr_dashboard_summary(target_starts_on, target_ends_on); end; $$;
create or replace function public.get_management_dashboard_summary(target_starts_on date, target_ends_on date)
returns jsonb language plpgsql security definer stable set search_path = '' as $$ begin return private.get_management_dashboard_summary(target_starts_on, target_ends_on); end; $$;
create or replace function public.get_hr_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
returns jsonb language plpgsql security definer stable set search_path = '' as $$ begin return private.get_hr_report(target_report_key, target_starts_on, target_ends_on, target_department_id, target_status, target_page, target_page_size); end; $$;
create or replace function public.get_management_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
returns jsonb language plpgsql security definer stable set search_path = '' as $$ begin return private.get_management_report(target_report_key, target_starts_on, target_ends_on, target_department_id, target_status, target_page, target_page_size); end; $$;

revoke all on function private.require_active_reporting_role(public.app_role[]), private.validate_reporting_range(date, date, integer, integer), private.get_hr_dashboard_summary(date, date), private.get_management_dashboard_summary(date, date), private.get_hr_report(text, date, date, bigint, text, integer, integer), private.get_management_report(text, date, date, bigint, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_hr_dashboard_summary(date, date), public.get_management_dashboard_summary(date, date), public.get_hr_report(text, date, date, bigint, text, integer, integer), public.get_management_report(text, date, date, bigint, text, integer, integer) from public, anon;
grant execute on function public.get_hr_dashboard_summary(date, date), public.get_management_dashboard_summary(date, date), public.get_hr_report(text, date, date, bigint, text, integer, integer), public.get_management_report(text, date, date, bigint, text, integer, integer) to authenticated;

create index reporting_applications_submitted_status_idx on public.applications (submitted_at desc, status);
create index reporting_employees_department_status_idx on public.employees (department_id, employment_status);
create index reporting_deployments_status_dates_idx on public.deployments (status, starts_on, ends_on);
create index reporting_attendance_date_status_idx on public.attendance_logs (attendance_date desc, status);
create index reporting_leave_starts_status_idx on public.leave_requests (starts_on desc, status);
create index reporting_promotion_evaluated_ready_idx on public.promotion_evaluations (evaluated_on desc, is_ready);
