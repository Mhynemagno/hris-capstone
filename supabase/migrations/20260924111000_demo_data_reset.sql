-- Client-requested reset (2026-09-24): clear all demo and transactional data so the client can
-- enter correct data, then load the station's rank and department catalogues.
-- Kept: login accounts, profiles, roles, applicant profiles and their profile documents,
-- account-linked employee rows (their department, rank, and unit station are cleared), and system
-- configuration (leave types, organization settings, attendance integration settings).
-- Storage objects are not touched here: Supabase blocks SQL deletes on storage.objects, so the
-- application-document and private-document buckets are emptied through the Storage API.

truncate table
  public.application_ai_scores,
  public.application_status_history,
  public.applicant_documents,
  public.employee_activation_requests,
  public.applications,
  public.job_qualification_criteria,
  public.job_openings,
  public.leave_request_attachments,
  public.leave_request_history,
  public.leave_requests,
  public.deployment_history,
  public.deployments,
  public.attendance_unmatched_events,
  public.attendance_logs,
  public.attendance_identity_mappings,
  public.attendance_imports,
  public.promotion_evaluation_evidence,
  public.employee_promotion_eligibility_summaries,
  public.promotion_evaluations,
  public.promotion_criteria_requirements,
  public.promotion_criteria,
  public.performance_ratings,
  public.service_history,
  public.qualifications,
  public.certifications,
  public.training_records,
  public.profile_change_request_history,
  public.profile_change_request_documents,
  public.profile_change_request_changes,
  public.profile_change_requests
restart identity;

select pgmq.purge_queue('application_analysis');

-- Keep only employee rows linked to a login; clear their organization placement.
-- Personnel history references employees (ON DELETE RESTRICT) and its trigger would record the
-- reset itself, so history is cleared first and the trigger is paused for these two statements.
truncate table public.employee_record_history restart identity;
alter table public.employees disable trigger employees_write_record_history;
delete from public.employees where profile_id is null;
update public.employees
set department_id = null, rank_id = null, unit_station = null, employment_status = 'active';
alter table public.employees enable trigger employees_write_record_history;

delete from public.unit_stations;
delete from public.ranks;
delete from public.departments;

-- Rules the legacy position rows could not meet (see 20260924110000_ranks_catalogue.sql).
alter table public.ranks
  add constraint ranks_name_key unique (name),
  add constraint ranks_code_check check (code = btrim(code) and char_length(code) between 1 and 16);

insert into public.ranks (name, code, sort_order) values
  ('Patrolman / Patrolwoman', 'Pat', 1),
  ('Police Corporal', 'PCpl', 2),
  ('Police Staff Sergeant', 'PSSg', 3),
  ('Police Master Sergeant', 'PMSg', 4),
  ('Police Senior Master Sergeant', 'PSMSg', 5),
  ('Police Chief Master Sergeant', 'PCMSg', 6),
  ('Police Executive Master Sergeant', 'PEMSg', 7),
  ('Police Lieutenant', 'PLt', 8),
  ('Police Captain', 'PCapt', 9),
  ('Police Major', 'PMAJ', 10),
  ('Police Lieutenant Colonel', 'PLTCOL', 11),
  ('Police Colonel', 'PCOL', 12);

insert into public.departments (name) values
  ('Station Administrative and Resource Management Section'),
  ('Station Investigation and Detective Management Section'),
  ('Women and Children Protection Desk'),
  ('Traffic and Investigation Unit'),
  ('Station Warrant and Subpoena Section'),
  ('Tactical Operations Center'),
  ('Intelligence Section'),
  ('Drug Enforcement Unit'),
  ('Police Community Precincts / Sub-Stations');

-- Last, so the reset's own trigger-written audit rows are cleared too.
truncate table public.notifications, public.audit_logs restart identity;
