begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(41);

select extensions.has_table('public', 'job_openings', 'Job openings table exists');
select extensions.has_table('public', 'job_qualification_criteria', 'Job qualification criteria table exists');
select extensions.has_table('public', 'applicants', 'Applicant profiles table exists');
select extensions.has_table('public', 'applications', 'Applications table exists');
select extensions.has_table('public', 'application_status_history', 'Application history table exists');
select extensions.has_table('public', 'applicant_documents', 'Applicant document metadata table exists');
select extensions.has_table('public', 'employee_activation_requests', 'Employee activation request table exists');
select extensions.has_table('public', 'application_ai_scores', 'Application AI scores table exists');
select extensions.has_function(
  'public',
  'list_hr_application_shortlist',
  array['text', 'text', 'smallint'],
  'HR AI shortlist query exists'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000009101', 'authenticated', 'authenticated', 'recruitment-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009102', 'authenticated', 'authenticated', 'recruitment-applicant@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009103', 'authenticated', 'authenticated', 'recruitment-admin@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000009101'::uuid then 'hr_personnel'::public.app_role
  when '00000000-0000-4000-8000-000000009103'::uuid then 'system_administrator'::public.app_role
  else 'applicant'::public.app_role
end
where user_id in (
  '00000000-0000-4000-8000-000000009101'::uuid,
  '00000000-0000-4000-8000-000000009102'::uuid,
  '00000000-0000-4000-8000-000000009103'::uuid
);

insert into public.departments (name) values ('Recruitment test department');
insert into public.positions (department_id, title)
select id, 'Recruitment test position' from public.departments where name = 'Recruitment test department';

insert into public.job_openings (department_id, position_id, title, description, status, published_at, created_by_user_id)
select department.id, position.id, opening.title, opening.description, opening.status, opening.published_at, '00000000-0000-4000-8000-000000009101'::uuid
from public.departments department
join public.positions position on position.department_id = department.id
cross join (
  values
    ('Published recruitment opening', 'A published opening visible to the public and applicants.', 'published'::text, now()),
    ('Draft recruitment opening', 'A draft opening visible only to Human Resources personnel.', 'draft'::text, null::timestamptz)
) as opening(title, description, status, published_at)
where department.name = 'Recruitment test department';

set local role anon;
select extensions.is((select count(*) from public.job_openings), 1::bigint, 'Anonymous visitors can read only published openings');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.is((select count(*) from public.job_openings), 1::bigint, 'Applicants can read only published openings');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.is((select count(*) from public.job_openings), 2::bigint, 'HR can read draft and published openings');

set local role postgres;
insert into public.applicants (id, profile_id, first_name, last_name)
values ('00000000-0000-4000-8000-000000009201', '00000000-0000-4000-8000-000000009102', 'Applicant', 'Fixture');

insert into storage.buckets (id, name, public, file_size_limit)
values ('applicant-documents', 'applicant-documents', false, 10485760)
on conflict (id) do nothing;

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000009301',
  'applicant-documents',
  'applicants/00000000-0000-4000-8000-000000009102/00000000-0000-4000-8000-000000009401/00000000-0000-4000-8000-000000009302.pdf',
  '00000000-0000-4000-8000-000000009102',
  '00000000-0000-4000-8000-000000009102',
  '{"mimetype":"application/pdf","size":1024}'::jsonb
);

select extensions.has_function('public', 'submit_application', array['uuid', 'bigint', 'text', 'jsonb'], 'Applicant submission workflow exists');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.lives_ok(
  $$select public.submit_application(
    '00000000-0000-4000-8000-000000009401'::uuid,
    (select id from public.job_openings where status = 'published'),
    'Ready to contribute.',
    '[{"kind":"cv","objectPath":"applicants/00000000-0000-4000-8000-000000009102/00000000-0000-4000-8000-000000009401/00000000-0000-4000-8000-000000009302.pdf","fileName":"cv.pdf","mimeType":"application/pdf","sizeBytes":1024}]'::jsonb
  )$$,
  'Applicant can submit an application with an owned CV'
);
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Submitted', 'Submission starts in Submitted status');

select extensions.has_function('public', 'transition_application_status', array['uuid', 'text', 'text'], 'HR transition workflow exists');
select extensions.has_function('public', 'hire_application', array['uuid', 'text', 'bigint', 'bigint', 'date', 'text'], 'Hiring workflow exists');

select extensions.throws_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Under Review', null)$$,
  '42501', 'HR access is required.', 'Applicants cannot transition their own application'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Under Review', 'Initial review started')$$,
  'HR can move Submitted to Under Review'
);
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Under Review', 'Review transition persists');

set local role postgres;
select extensions.throws_ok(
  $$insert into public.application_ai_scores (
      application_id, requested_by_user_id, status, score, explanation,
      provider, model, model_version, input_at, completed_at
    ) values (
      '00000000-0000-4000-8000-000000009401',
      '00000000-0000-4000-8000-000000009101',
      'completed', 101, 'Score exceeds the permitted range.',
      'gemini', 'gemini-2.5-flash-lite', '2026-08', now(), now()
    )$$,
  '23514', null, 'AI scores reject values above 100'
);

insert into public.applications (id, applicant_id, job_opening_id, status)
select
  '00000000-0000-4000-8000-000000009402',
  applicant.id,
  opening.id,
  'Submitted'
from public.applicants applicant
join public.job_openings opening on opening.status = 'draft'
where applicant.profile_id = '00000000-0000-4000-8000-000000009102';

insert into public.application_ai_scores (
  application_id, requested_by_user_id, status, score, explanation,
  provider, model, model_version, input_at, completed_at
) values
  (
    '00000000-0000-4000-8000-000000009401',
    '00000000-0000-4000-8000-000000009101',
    'completed', 72, 'Matches core education and experience criteria.',
    'gemini', 'gemini-2.5-flash-lite', '2026-08', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000009402',
    '00000000-0000-4000-8000-000000009101',
    'completed', 88, 'Matches required skills and preferred certification.',
    'gemini', 'gemini-2.5-flash-lite', '2026-08', now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.is((select count(*) from public.application_ai_scores), 2::bigint, 'HR can read AI score recommendations');
select extensions.is(
  (
    select array_agg(application_id order by ai_score desc)
    from public.list_hr_application_shortlist(null, 'completed', null)
  ),
  array[
    '00000000-0000-4000-8000-000000009402'::uuid,
    '00000000-0000-4000-8000-000000009401'::uuid
  ],
  'HR shortlist ranks completed recommendations by score'
);
select extensions.is(
  (select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid),
  'Under Review',
  'AI scoring does not change the application status'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.is((select count(*) from public.application_ai_scores), 0::bigint, 'Applicants cannot read AI score recommendations');
select extensions.throws_ok(
  $$insert into public.application_ai_scores (application_id, requested_by_user_id, status)
    values (
      '00000000-0000-4000-8000-000000009401',
      '00000000-0000-4000-8000-000000009102',
      'pending'
    )$$,
  '42501', null, 'Applicants cannot write AI score recommendations'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.lives_ok(
  $$select public.transition_application_status('00000000-0000-4000-8000-000000009401'::uuid, 'Shortlisted', 'Meets the required criteria')$$,
  'HR can shortlist an application under review'
);
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Shortlisted', 'Shortlist transition persists');

select extensions.lives_ok(
  $$select public.hire_application(
    '00000000-0000-4000-8000-000000009401'::uuid,
    'EMP-2026-001',
    (select department_id from public.job_openings where status = 'published'),
    (select position_id from public.job_openings where status = 'published'),
    '2026-10-15',
    'Selected after a successful interview.'
  )$$,
  'HR hiring creates the employee and pending activation request atomically'
);
set local role postgres;
select extensions.is((select status from public.applications where id = '00000000-0000-4000-8000-000000009401'::uuid), 'Hired', 'Hiring persists the terminal application status');
select extensions.is(
  (select profile_id from public.employees employee join public.applications application on application.hired_employee_id = employee.id where application.id = '00000000-0000-4000-8000-000000009401'::uuid),
  '00000000-0000-4000-8000-000000009102'::uuid,
  'Hired employee links the applicant account'
);
select extensions.is((select status from public.employee_activation_requests where application_id = '00000000-0000-4000-8000-000000009401'::uuid), 'pending', 'Hiring creates a pending activation request');
select extensions.is((select role from public.user_roles where user_id = '00000000-0000-4000-8000-000000009102'::uuid), 'applicant'::public.app_role, 'Hiring does not grant the Employee role');
select extensions.ok(exists (
  select 1 from public.audit_logs
  where actor_user_id = '00000000-0000-4000-8000-000000009101'::uuid
    and entity_type = 'applications'
    and entity_id = '00000000-0000-4000-8000-000000009401'
    and action = 'hired'
), 'Hiring writes an audit record');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009103';
select extensions.lives_ok(
  $$select public.update_managed_user('00000000-0000-4000-8000-000000009102'::uuid, 'employee'::public.app_role, true)$$,
  'Administrator activates the hired applicant through the existing workflow'
);
select extensions.is((select status from public.employee_activation_requests where application_id = '00000000-0000-4000-8000-000000009401'::uuid), 'activated', 'Administrator activation completes the pending request');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009101';
select extensions.lives_ok(
  $$insert into public.job_openings (department_id, position_id, title, description, created_by_user_id)
    select department.id, position.id, 'HR created opening', 'An opening created directly by authorized Human Resources personnel.', '00000000-0000-4000-8000-000000009101'::uuid
    from public.departments department join public.positions position on position.department_id = department.id
    where department.name = 'Recruitment test department'$$,
  'HR can create a draft job opening'
);
select extensions.lives_ok(
  $$insert into public.job_qualification_criteria (job_opening_id, ordinal, kind, requirement)
    select id, 1, 'experience', 'Two years of related experience'
    from public.job_openings where title = 'HR created opening'$$,
  'HR can create qualification criteria'
);
select extensions.lives_ok(
  $$update public.job_openings set status = 'published', published_at = now() where title = 'HR created opening'$$,
  'HR can publish an opening'
);
select extensions.throws_ok(
  $$delete from public.job_openings where title = 'HR created opening'$$,
  '42501', null, 'HR cannot hard-delete job openings'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009102';
select extensions.throws_ok(
  $$insert into public.job_openings (department_id, position_id, title, description, created_by_user_id)
    select department.id, position.id, 'Applicant created opening', 'An unauthorized opening attempt by an applicant account.', '00000000-0000-4000-8000-000000009102'::uuid
    from public.departments department join public.positions position on position.department_id = department.id
    where department.name = 'Recruitment test department'$$,
  '42501', null, 'Applicants cannot create job openings'
);
select * from extensions.finish();
rollback;
