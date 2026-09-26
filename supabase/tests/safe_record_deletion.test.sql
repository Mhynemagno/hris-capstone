begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(40);

-- Fixture accounts: two administrators, HR, an unused applicant, and an applicant with an application.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000009501', 'authenticated', 'authenticated', 'delete-admin-a@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009502', 'authenticated', 'authenticated', 'delete-admin-b@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009503', 'authenticated', 'authenticated', 'delete-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009504', 'authenticated', 'authenticated', 'delete-unused@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009505', 'authenticated', 'authenticated', 'delete-applicant@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000009501'::uuid then 'system_administrator'::public.app_role
  when '00000000-0000-4000-8000-000000009502'::uuid then 'system_administrator'::public.app_role
  when '00000000-0000-4000-8000-000000009503'::uuid then 'hr_personnel'::public.app_role
  else 'applicant'::public.app_role
end
where user_id between '00000000-0000-4000-8000-000000009501'::uuid and '00000000-0000-4000-8000-000000009505'::uuid;

insert into public.departments (name) values ('Deletion unused department'), ('Deletion used department');
insert into public.ranks (name, code, sort_order)
values ('Deletion used rank', 'DUR', 9301), ('Deletion criterion rank', 'DCR', 9302);

insert into public.job_openings (department_id, rank_id, title, description, status, published_at, created_by_user_id)
select (select id from public.departments where name = 'Deletion used department'), rank.id, opening.title, 'An opening used by the safe deletion regression tests.', opening.status, opening.published_at, '00000000-0000-4000-8000-000000009503'::uuid
from public.ranks rank
cross join (values ('Deletion draft opening', 'draft'::text, null::timestamptz), ('Deletion published opening', 'published'::text, now())) opening(title, status, published_at)
where rank.code = 'DUR';

insert into public.leave_types (id, name, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000009521', 'Deletion unused leave', '00000000-0000-4000-8000-000000009503', '00000000-0000-4000-8000-000000009503');

insert into public.promotion_criteria (id, target_rank_id, minimum_years_of_service, created_by_user_id, updated_by_user_id)
select '00000000-0000-4000-8000-000000009531', id, 2, '00000000-0000-4000-8000-000000009503', '00000000-0000-4000-8000-000000009503'
from public.ranks where code = 'DCR';
insert into public.promotion_criteria_requirements (criterion_id, ordinal, record_kind, required_name, label)
values ('00000000-0000-4000-8000-000000009531', 1, 'training', 'Leadership course', 'Leadership course');

insert into public.notifications (id, recipient_user_id, type, title, body)
values ('00000000-0000-4000-8000-000000009541', '00000000-0000-4000-8000-000000009504', 'announcement', 'Deletion notice', 'A notification for the deletion tests.');

-- ---------------------------------------------------------------------------
-- Authorisation
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009503';

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009501';
select extensions.throws_ok(
  $$select public.delete_leave_type('00000000-0000-4000-8000-000000009521')$$,
  '42501', 'HR access is required.', 'Administrators cannot delete HR-owned leave types');
select extensions.throws_ok(
  $$select public.get_deletion_impact('employee', '00000000-0000-4000-8000-000000009501')$$,
  '42501', 'HR access is required.', 'Administrators cannot assess personnel record deletion');
select extensions.throws_ok(
  $$select public.get_deletion_impact('managed_user', 'not-a-uuid')$$,
  '22023', 'The record identifier is not valid.', 'Malformed identifiers are rejected cleanly');

set local role anon;
select extensions.throws_ok(
  $$select public.get_deletion_impact('notification', '00000000-0000-4000-8000-000000009541')$$,
  '42501', null, 'Anonymous callers cannot reach deletion RPCs');

-- ---------------------------------------------------------------------------
-- Departments and ranks are never deletable (client decision 2026-09-24)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009501';
select extensions.throws_ok(
  $$select public.get_deletion_impact('department', (select id::text from public.departments where name = 'Deletion unused department'))$$,
  '22023', 'Deletion is not supported for this record type.', 'Departments are never deletable');
select extensions.throws_ok(
  $$select public.get_deletion_impact('position', (select id::text from public.ranks where code = 'DUR'))$$,
  '22023', 'Deletion is not supported for this record type.', 'Ranks are never deletable');
select extensions.throws_ok(
  $$delete from public.departments where name = 'Deletion unused department'$$,
  '42501', null, 'Administrators cannot delete department rows directly');

-- ---------------------------------------------------------------------------
-- Leave types and promotion criteria (HR-owned)
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009503';
select extensions.lives_ok(
  $$select public.delete_leave_type('00000000-0000-4000-8000-000000009521')$$,
  'HR can delete an unused leave type');
select extensions.ok(
  public.get_deletion_impact('promotion_criterion', '00000000-0000-4000-8000-000000009531') -> 'removes'
    @> '[{"label": "required credentials", "count": 1}]'::jsonb,
  'Promotion criterion impact lists the requirements that will be removed with it');
select extensions.lives_ok(
  $$select public.delete_promotion_criterion('00000000-0000-4000-8000-000000009531')$$,
  'HR can delete promotion criteria that have no evaluations');
set local role postgres;
select extensions.is((select count(*) from public.leave_types where id = '00000000-0000-4000-8000-000000009521'), 0::bigint, 'The leave type row is removed');
select extensions.ok(exists (
  select 1 from public.audit_logs where entity_type = 'leave_types' and action = 'delete' and entity_id = '00000000-0000-4000-8000-000000009521'
), 'Leave type deletion is audited');
select extensions.is((select count(*) from public.promotion_criteria_requirements where criterion_id = '00000000-0000-4000-8000-000000009531'), 0::bigint, 'Criterion requirements are removed with the criterion');
select extensions.ok(exists (
  select 1 from public.audit_logs where entity_type = 'promotion_criteria' and action = 'delete'
    and entity_id = '00000000-0000-4000-8000-000000009531' and jsonb_array_length(metadata -> 'requirements') = 1
), 'Promotion criterion deletion is audited with its requirements');

-- Criteria with evaluation evidence can still be deactivated (but not deleted).
set local role postgres;
insert into public.promotion_criteria (id, target_rank_id, minimum_years_of_service, created_by_user_id, updated_by_user_id)
select '00000000-0000-4000-8000-000000009532', id, 1, '00000000-0000-4000-8000-000000009503', '00000000-0000-4000-8000-000000009503'
from public.ranks where code = 'DUR';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009501';
select extensions.throws_ok(
  $$select public.set_promotion_criterion_active('00000000-0000-4000-8000-000000009532', false)$$,
  '42501', 'HR access is required.', 'Only HR can change promotion criteria status');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009503';
select extensions.lives_ok(
  $$select public.set_promotion_criterion_active('00000000-0000-4000-8000-000000009532', false)$$,
  'HR can deactivate promotion criteria without rewriting their requirements');
set local role postgres;
select extensions.ok(
  (select not is_active from public.promotion_criteria where id = '00000000-0000-4000-8000-000000009532')
    and exists (select 1 from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000009532' and action = 'deactivated'),
  'Criteria deactivation is persisted and audited');

-- ---------------------------------------------------------------------------
-- Job openings: drafts only, audited
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009503';
select extensions.throws_like(
  $$select public.delete_draft_job_opening((select id from public.job_openings where title = 'Deletion published opening'))$$,
  '%Only draft openings can be deleted%Withdraw the opening%', 'Published openings cannot be deleted and point to withdrawal');
select extensions.lives_ok(
  $$select public.delete_draft_job_opening((select id from public.job_openings where title = 'Deletion draft opening'))$$,
  'HR can delete an unreferenced draft opening');
set local role postgres;
select extensions.ok(exists (
  select 1 from public.audit_logs where entity_type = 'job_openings' and action = 'delete' and metadata ->> 'title' = 'Deletion draft opening'
), 'Draft opening deletion is audited');

-- ---------------------------------------------------------------------------
-- Notifications: only the recipient
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009505';
select extensions.throws_ok(
  $$select public.delete_notification('00000000-0000-4000-8000-000000009541')$$,
  'P0001', 'Notification was not found.', 'Users cannot delete someone else''s notification');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009504';
select extensions.lives_ok(
  $$select public.delete_notification('00000000-0000-4000-8000-000000009541')$$,
  'Recipients can delete their own notification');

-- ---------------------------------------------------------------------------
-- Managed accounts (checked before the Edge Function removes the auth user)
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009503';
select extensions.throws_ok(
  $$select public.assert_managed_user_deletable('00000000-0000-4000-8000-000000009504')$$,
  '42501', 'Administrator access is required.', 'HR cannot delete accounts');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009501';
select extensions.throws_like(
  $$select public.assert_managed_user_deletable('00000000-0000-4000-8000-000000009501')$$,
  '%You cannot delete your own account.%', 'Administrators cannot delete themselves');
select extensions.throws_like(
  $$select public.assert_managed_user_deletable('00000000-0000-4000-8000-000000009503')$$,
  '%It is still used by%job openings%Deactivate the account%', 'Accounts that created records must be deactivated instead');
select extensions.lives_ok(
  $$select public.assert_managed_user_deletable('00000000-0000-4000-8000-000000009504')$$,
  'An account with no dependent records can be deleted');

set local role postgres;
update public.profiles set is_active = false where id = '00000000-0000-4000-8000-000000009501';
set local role authenticated;
select extensions.throws_ok(
  $$select public.assert_managed_user_deletable('00000000-0000-4000-8000-000000009504')$$,
  '42501', 'Administrator access is required.', 'Deactivated administrators cannot delete accounts');

-- ---------------------------------------------------------------------------
-- Regression: HR can save demographic fields on a personnel record
-- ---------------------------------------------------------------------------
set local role postgres;
insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values ('00000000-0000-4000-8000-000000009581', 'DEL-EMP-1', 'Grant', 'Check', 'grant.check@example.test', '2024-01-01');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009503';
select extensions.lives_ok(
  $$update public.employees set qualifier = 'Jr.', place_of_birth = 'San Juan', date_of_birth = '1990-01-01', gender = 'female', civil_status = 'single', religion = 'None', phone = '09170000000'
    where id = '00000000-0000-4000-8000-000000009581'$$,
  'HR can update every field the personnel edit form sends');
set local role postgres;
select extensions.is((select qualifier || '/' || civil_status from public.employees where id = '00000000-0000-4000-8000-000000009581'), 'Jr./single', 'Personnel demographic edits persist');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009505';
update public.employees set religion = 'Changed by applicant' where id = '00000000-0000-4000-8000-000000009581';
set local role postgres;
select extensions.is((select religion from public.employees where id = '00000000-0000-4000-8000-000000009581'), 'None', 'Non-HR users still cannot update personnel records');

-- ---------------------------------------------------------------------------
-- Regression: resubmitting a Needs Revision application keeps the new files
-- ---------------------------------------------------------------------------
set local role postgres;
insert into public.applicants (id, profile_id, first_name, last_name)
values ('00000000-0000-4000-8000-000000009551', '00000000-0000-4000-8000-000000009505', 'Revision', 'Applicant')
on conflict (profile_id) do update set first_name = excluded.first_name;
insert into public.applications (id, applicant_id, job_opening_id, status)
select '00000000-0000-4000-8000-000000009561', applicant.id, opening.id, 'Needs Revision'
from public.applicants applicant, public.job_openings opening
where applicant.profile_id = '00000000-0000-4000-8000-000000009505' and opening.title = 'Deletion published opening';
insert into public.applicant_documents (application_id, kind, object_path, file_name, mime_type, size_bytes, uploaded_by_user_id)
values ('00000000-0000-4000-8000-000000009561', 'cv', 'applicants/00000000-0000-4000-8000-000000009505/00000000-0000-4000-8000-000000009561/00000000-0000-4000-8000-000000009571.pdf', 'old-cv.pdf', 'application/pdf', 1024, '00000000-0000-4000-8000-000000009505');
insert into storage.buckets (id, name, public, file_size_limit)
values ('applicant-documents', 'applicant-documents', false, 10485760)
on conflict (id) do nothing;
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values ('00000000-0000-4000-8000-000000009572', 'applicant-documents',
  'applicants/00000000-0000-4000-8000-000000009505/00000000-0000-4000-8000-000000009561/00000000-0000-4000-8000-000000009573.pdf',
  '00000000-0000-4000-8000-000000009505', '00000000-0000-4000-8000-000000009505', '{"mimetype":"application/pdf","size":2048}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009505';
select extensions.lives_ok(
  $$select public.resubmit_application('00000000-0000-4000-8000-000000009561', '[{"kind":"cv","objectPath":"applicants/00000000-0000-4000-8000-000000009505/00000000-0000-4000-8000-000000009561/00000000-0000-4000-8000-000000009573.pdf","fileName":"new-cv.pdf","mimeType":"application/pdf","sizeBytes":2048}]'::jsonb)$$,
  'Applicants can resubmit a Needs Revision application');
set local role postgres;
select extensions.results_eq(
  $$select file_name from public.applicant_documents where application_id = '00000000-0000-4000-8000-000000009561'$$,
  $$values ('new-cv.pdf'::text)$$,
  'Resubmission replaces the old documents and keeps the newly uploaded ones');

-- ---------------------------------------------------------------------------
-- Personnel records: HR can delete one only while no official record uses it
-- ---------------------------------------------------------------------------
set local role postgres;
insert into public.employees (id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000009591', '9-00001', 'Mistaken', 'Entry', 'mistaken.entry@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000009592', '9-00002', 'Rated', 'Officer', 'rated.officer@example.test', '2020-01-01');
insert into public.qualifications (employee_id, name, institution, awarded_on)
values ('00000000-0000-4000-8000-000000009591', 'Baccalaureate Degree', 'State University or College', '2019-06-01');
insert into public.performance_ratings (employee_id, rating, review_period_starts_on, review_period_ends_on, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000009592', 4, '2025-01-01', '2025-12-31', '00000000-0000-4000-8000-000000009503', '00000000-0000-4000-8000-000000009503');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009505';
select extensions.throws_ok(
  $$select public.delete_employee('00000000-0000-4000-8000-000000009591')$$,
  '42501', 'HR access is required.', 'Only HR can delete a personnel record');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009503';
select extensions.is(
  (public.get_deletion_impact('employee', '00000000-0000-4000-8000-000000009591') ->> 'canDelete')::boolean, true,
  'A personnel record with only personnel entries can be deleted');
select extensions.is(
  public.get_deletion_impact('employee', '00000000-0000-4000-8000-000000009591') -> 'removes',
  '[{"label": "qualifications", "count": 1}]'::jsonb,
  'The impact preview lists the personnel entries removed with the record');
select extensions.is(
  (public.get_deletion_impact('employee', '00000000-0000-4000-8000-000000009592') ->> 'canDelete')::boolean, false,
  'Official records such as performance ratings block deleting a personnel record');
select extensions.throws_ok(
  $$select public.delete_employee('00000000-0000-4000-8000-000000009592')$$,
  'P0001', null, 'Deleting a personnel record that official records use is refused');
select extensions.lives_ok(
  $$select public.delete_employee('00000000-0000-4000-8000-000000009591')$$,
  'HR can delete an unused personnel record');

set local role postgres;
select extensions.is(
  (select count(*) from public.employees where id = '00000000-0000-4000-8000-000000009591')
    + (select count(*) from public.qualifications where employee_id = '00000000-0000-4000-8000-000000009591')
    + (select count(*) from public.employee_record_history where employee_id = '00000000-0000-4000-8000-000000009591'),
  0::bigint,
  'The record, its entries, and its record history are removed');
select extensions.ok(
  exists (
    select 1 from public.audit_logs
    where entity_type = 'employees' and entity_id = '00000000-0000-4000-8000-000000009591' and action = 'delete'
      and metadata -> 'entries' -> 'qualifications' -> 0 ->> 'name' = 'Baccalaureate Degree'
  ),
  'The audit log keeps a full snapshot of the deleted personnel record');

select * from extensions.finish();

rollback;
