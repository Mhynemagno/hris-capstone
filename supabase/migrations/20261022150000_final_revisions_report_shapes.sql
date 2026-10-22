-- Final Revisions: keep legacy reports available while splitting operational reports.
alter function private.get_hr_report(text, date, date, bigint, text, integer, integer) rename to get_hr_report_legacy;
alter function private.get_management_report(text, date, date, bigint, text, integer, integer) rename to get_management_report_legacy;

create or replace function private.get_hr_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; page_offset integer := (target_page - 1) * target_page_size;
begin
  perform private.require_active_reporting_role(array['hr_personnel'::public.app_role]);
  perform private.validate_reporting_range(target_starts_on, target_ends_on, target_page, target_page_size);
  if target_report_key not in ('attendance','leave','promotion-evaluation','training-needs') then
    return private.get_hr_report_legacy(target_report_key,target_starts_on,target_ends_on,target_department_id,target_status,target_page,target_page_size);
  end if;
  if target_report_key = 'attendance' then
    with filtered as (select e.employee_number, concat_ws(' ',e.first_name,e.last_name) employee, r.code rank, a.status, a.attendance_date date from public.attendance_logs a join public.employees e on e.id=a.employee_id left join public.ranks r on r.id=e.rank_id where a.attendance_date between target_starts_on and target_ends_on and (target_department_id is null or e.department_id=target_department_id) and (target_status is null or a.status=target_status)), paged as (select * from filtered order by date desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey',target_report_key,'title','Attendance','generatedAt',now(),'columns',jsonb_build_array(jsonb_build_object('key','rank','label','Rank'),jsonb_build_object('key','employee','label','Name'),jsonb_build_object('key','employeeNumber','label','Badge Number'),jsonb_build_object('key','status','label','Status'),jsonb_build_object('key','date','label','Date')),'rows',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'employee',employee,'employeeNumber',employee_number,'status',status,'date',date)) from paged),'[]'::jsonb),'totalCount',(select count(*) from filtered),'page',target_page,'pageSize',target_page_size) into result;
  elsif target_report_key = 'leave' then
    with filtered as (select e.employee_number, concat_ws(' ',e.first_name,e.last_name) employee, r.code rank, l.status, lt.name leave_type, l.starts_on date from public.leave_requests l join public.employees e on e.id=l.employee_id left join public.ranks r on r.id=e.rank_id join public.leave_types lt on lt.id=l.leave_type_id where l.starts_on between target_starts_on and target_ends_on and (target_department_id is null or e.department_id=target_department_id) and (target_status is null or l.status=target_status)), paged as (select * from filtered order by date desc limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey',target_report_key,'title','Leave','generatedAt',now(),'columns',jsonb_build_array(jsonb_build_object('key','rank','label','Rank'),jsonb_build_object('key','employee','label','Name'),jsonb_build_object('key','employeeNumber','label','Badge Number'),jsonb_build_object('key','leaveType','label','Leave Type'),jsonb_build_object('key','status','label','Status')),'rows',coalesce((select jsonb_agg(jsonb_build_object('rank',rank,'employee',employee,'employeeNumber',employee_number,'leaveType',leave_type,'status',status)) from paged),'[]'::jsonb),'totalCount',(select count(*) from filtered),'page',target_page,'pageSize',target_page_size) into result;
  else
    with filtered as (select e.employee_number, concat_ws(' ',e.first_name,e.last_name) employee, fr.code rank, tr.code target_rank, coalesce(d.status,'for_approval') status, private.evaluate_promotion(e.id,current_date) evaluation from public.employees e join public.ranks fr on fr.id=e.rank_id left join lateral (select * from private.evaluate_promotion(e.id,current_date)) x on true left join public.ranks tr on tr.id=(x.evaluation->'targetRank'->>'id')::bigint left join public.promotion_decisions d on d.employee_id=e.id and d.target_rank_id=tr.id where e.employment_status='active' and fr.code <> 'NUP' and tr.id is not null and (target_department_id is null or e.department_id=target_department_id) and (target_status is null or coalesce(d.status,'for_approval')=target_status)), paged as (select * from filtered order by employee_number limit target_page_size offset page_offset)
    select jsonb_build_object('reportKey',target_report_key,'title',case when target_report_key='promotion-evaluation' then 'Promotion Evaluation' else 'Training Needs' end,'generatedAt',now(),'columns',case when target_report_key='promotion-evaluation' then jsonb_build_array(jsonb_build_object('key','rank','label','Rank'),jsonb_build_object('key','employee','label','Name'),jsonb_build_object('key','targetRank','label','Target Rank'),jsonb_build_object('key','status','label','Status')) else jsonb_build_array(jsonb_build_object('key','rank','label','Rank'),jsonb_build_object('key','employee','label','Name'),jsonb_build_object('key','course','label','Required Course')) end,'rows',coalesce((select jsonb_agg(case when target_report_key='promotion-evaluation' then jsonb_build_object('rank',rank,'employee',employee,'targetRank',target_rank,'status',status) else jsonb_build_object('rank',rank,'employee',employee,'course',coalesce((evaluation->'trainings'->0->>'name'), 'Required training')) end) from paged where target_report_key='promotion-evaluation' or jsonb_array_length(coalesce(evaluation->'missingRequirements','[]'::jsonb)) > 0),'[]'::jsonb),'totalCount',(select count(*) from filtered),'page',target_page,'pageSize',target_page_size) into result;
  end if;
  return result;
end $$;

create or replace function private.get_management_report(target_report_key text, target_starts_on date, target_ends_on date, target_department_id bigint, target_status text, target_page integer, target_page_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active_reporting_role(array['management'::public.app_role]);
  if target_report_key in ('attendance','leave','promotion-evaluation','training-needs') then
    raise exception 'This operational report is restricted to HR.' using errcode='42501';
  end if;
  return private.get_management_report_legacy(target_report_key,target_starts_on,target_ends_on,target_department_id,target_status,target_page,target_page_size);
end $$;

revoke all on function private.get_hr_report_legacy(text,date,date,bigint,text,integer,integer), private.get_management_report_legacy(text,date,date,bigint,text,integer,integer), private.get_hr_report(text,date,date,bigint,text,integer,integer), private.get_management_report(text,date,date,bigint,text,integer,integer) from public, anon, authenticated;
