begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(29);

-- NUP is the most junior rank and is listed first.
select extensions.is((select sort_order from public.ranks where code = 'NUP'), 0, 'NUP has sort order 0');
select extensions.is((select code from public.ranks order by sort_order limit 1), 'NUP', 'NUP is listed first, above PAT');
select extensions.is(
  (select code from public.ranks where sort_order > (select sort_order from public.ranks where code = 'NUP') order by sort_order limit 1),
  'PAT', 'PAT follows NUP'
);
select extensions.throws_ok(
  $$insert into public.ranks (name, code, sort_order) values ('Negative order rank', 'NEG', -1)$$,
  '23514', null, 'Rank order cannot be negative'
);

-- Eligibility rating.
select extensions.has_column('public', 'qualifications', 'rating', 'Eligibility records a rating');
select extensions.col_type_is('public', 'qualifications', 'rating', 'numeric(5,2)', 'Eligibility rating is a percent with two decimals');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002201', 'authenticated', 'authenticated', 'final-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002202', 'authenticated', 'authenticated', 'final-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000002203', 'authenticated', 'authenticated', 'final-other@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000002201'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end
where user_id in ('00000000-0000-4000-8000-000000002201'::uuid, '00000000-0000-4000-8000-000000002202'::uuid, '00000000-0000-4000-8000-000000002203'::uuid);

insert into public.ranks (id, name, code, sort_order, is_active) overriding system value
values (9951, 'Final Revisions Base Rank', 'FRB', 9951, true), (9952, 'Final Revisions Next Rank', 'FRN', 9952, true);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, rank_id, employment_started_on, date_of_birth, emergency_contact_relationship)
values
  ('00000000-0000-4000-8000-000000002211', '00000000-0000-4000-8000-000000002202', '1-22110', 'Juan', 'Dela Cruz', 'final-employee@example.test', 9952, '2015-03-01', '1990-01-01', 'parent'),
  ('00000000-0000-4000-8000-000000002212', '00000000-0000-4000-8000-000000002203', '1-22120', 'Other', 'Officer', 'final-other@example.test', 9951, '2018-01-01', null, 'parent');

insert into public.service_history (employee_id, rank_id, started_on)
values
  ('00000000-0000-4000-8000-000000002211', 9951, '2015-03-01'),
  ('00000000-0000-4000-8000-000000002211', 9952, '2021-07-01');

select extensions.lives_ok(
  $$insert into public.qualifications (employee_id, name, awarded_on, rating) values ('00000000-0000-4000-8000-000000002211', 'NAPOLCOM PNP Entrance Examination', '2014-10-01', 85)$$,
  'An eligibility can be saved with a rating'
);
select extensions.lives_ok(
  $$insert into public.qualifications (employee_id, name, awarded_on, rating) values ('00000000-0000-4000-8000-000000002211', 'Career Service Professional', '2016-10-01', null)$$,
  'An employee can have several eligibilities, with or without a rating'
);
select extensions.throws_ok(
  $$insert into public.qualifications (employee_id, name, awarded_on, rating) values ('00000000-0000-4000-8000-000000002211', 'Invalid rating', '2016-10-01', 101)$$,
  '23514', null, 'An eligibility rating cannot exceed 100 percent'
);

create function public.final_revisions_test_document(target_request_id uuid) returns jsonb language plpgsql as $$
declare target_path text := 'profile-change-requests/' || auth.uid()::text || '/' || target_request_id::text || '/22222222-2222-4222-8222-222222222222.pdf';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('private-documents', target_path, auth.uid()::text);
  return jsonb_build_array(jsonb_build_object('objectPath', target_path, 'fileName', 'proof.pdf', 'mimeType', 'application/pdf', 'sizeBytes', 100));
end;
$$;

-- Extended personal-field change request.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002202';
select extensions.lives_ok(
  $$select public.submit_profile_change_request('00000000-0000-4000-8000-000000002301'::uuid, 'Birth certificate attached',
    '[{"kind":"contact","field":"firstName","originalValue":"Juan","requestedValue":"Juan Miguel"},
      {"kind":"contact","field":"dateOfBirth","originalValue":"1990-01-01","requestedValue":"1990-02-14"},
      {"kind":"contact","field":"civilStatus","originalValue":null,"requestedValue":"married"},
      {"kind":"qualification","operation":"add","originalValue":null,"requestedValue":{"name":"Civil Service Professional","institution":null,"qualificationLevel":null,"fieldOfStudy":null,"awardedOn":"2017-05-01","notes":null,"rating":82.5}}]'::jsonb,
    public.final_revisions_test_document('00000000-0000-4000-8000-000000002301'::uuid))$$,
  'Employee requests corrections to HR-entered personal fields and an eligibility with a rating'
);
select extensions.is((select first_name from public.employees where id = '00000000-0000-4000-8000-000000002211'::uuid), 'Juan', 'Submission does not change the official record');
select extensions.throws_ok(
  $$select public.submit_profile_change_request('00000000-0000-4000-8000-000000002302'::uuid, null, '[{"kind":"contact","field":"gender","originalValue":null,"requestedValue":"unknown"}]'::jsonb, public.final_revisions_test_document('00000000-0000-4000-8000-000000002302'::uuid))$$,
  '22023', 'Choose a gender.', 'An invalid gender is rejected on submission'
);
select extensions.throws_ok(
  $$select public.submit_profile_change_request('00000000-0000-4000-8000-000000002303'::uuid, null, '[{"kind":"contact","field":"employeeNumber","originalValue":"1-22110","requestedValue":"12345"}]'::jsonb, public.final_revisions_test_document('00000000-0000-4000-8000-000000002303'::uuid))$$,
  '22023', null, 'A badge number keeps its format rule'
);
select extensions.throws_ok(
  $$select public.submit_profile_change_request('00000000-0000-4000-8000-000000002304'::uuid, null, '[{"kind":"contact","field":"lastName","originalValue":"Dela Cruz","requestedValue":""}]'::jsonb, public.final_revisions_test_document('00000000-0000-4000-8000-000000002304'::uuid))$$,
  '22023', 'A value is required for this field.', 'A required field cannot be cleared'
);
select extensions.throws_ok(
  $$select public.submit_profile_change_request('00000000-0000-4000-8000-000000002305'::uuid, null, '[{"kind":"qualification","operation":"add","originalValue":null,"requestedValue":{"name":"Too high","institution":null,"qualificationLevel":null,"fieldOfStudy":null,"awardedOn":"2017-05-01","notes":null,"rating":120}}]'::jsonb, public.final_revisions_test_document('00000000-0000-4000-8000-000000002305'::uuid))$$,
  '22023', 'Enter a rating from 0 to 100 percent.', 'An eligibility rating above 100 is rejected'
);
select extensions.throws_ok(
  $$select public.decide_profile_change_request('00000000-0000-4000-8000-000000002301'::uuid, 'approved', null)$$,
  '42501', null, 'An employee cannot decide a request'
);
select extensions.is(public.get_employee_time_in_grade('00000000-0000-4000-8000-000000002211'::uuid), '2021-07-01'::date, 'An employee reads their own time-in-grade start');
select extensions.throws_ok(
  $$select public.get_employee_time_in_grade('00000000-0000-4000-8000-000000002212'::uuid)$$,
  '42501', null, 'An employee cannot read another employee''s time in grade'
);

set local role postgres;
select extensions.ok(
  exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000002201'::uuid and type = 'profile_change_submitted' and link = '/hr/profile-requests/00000000-0000-4000-8000-000000002301'),
  'Submitting a request notifies HR with a link to the HR review page'
);
select extensions.ok(
  not exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000002202'::uuid and type = 'profile_change_submitted'),
  'The requester is not notified of their own submission'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002201';
select extensions.is((select count(*) from public.profile_change_requests where id = '00000000-0000-4000-8000-000000002301'::uuid), 1::bigint, 'HR can read submitted requests');
select extensions.is((select count(*) from public.profile_change_request_changes where request_id = '00000000-0000-4000-8000-000000002301'::uuid), 4::bigint, 'HR can read the requested changes');
select extensions.is((select count(*) from public.profile_change_request_documents where request_id = '00000000-0000-4000-8000-000000002301'::uuid), 1::bigint, 'HR can read the supporting documents');
select extensions.is(public.get_employee_time_in_grade('00000000-0000-4000-8000-000000002212'::uuid), '2018-01-01'::date, 'Without service history in the current rank, time in grade starts at Date Entered Service');
select extensions.lives_ok(
  $$select public.decide_profile_change_request('00000000-0000-4000-8000-000000002301'::uuid, 'approved', null)$$,
  'HR approves the request'
);

set local role postgres;
select extensions.is(
  (select first_name || '|' || date_of_birth::text || '|' || civil_status from public.employees where id = '00000000-0000-4000-8000-000000002211'::uuid),
  'Juan Miguel|1990-02-14|married', 'Approval applies the personal-field corrections with the right types'
);
select extensions.is(
  (select rating from public.qualifications where employee_id = '00000000-0000-4000-8000-000000002211'::uuid and name = 'Civil Service Professional'),
  82.50::numeric, 'Approval adds the requested eligibility with its rating'
);
select extensions.ok(
  exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000002202'::uuid and type = 'profile_change_decision'),
  'The employee is notified of the decision'
);

-- HR cannot review a request they submitted themselves.
update public.employees set profile_id = '00000000-0000-4000-8000-000000002201' where id = '00000000-0000-4000-8000-000000002212';
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002201';
select public.submit_profile_change_request('00000000-0000-4000-8000-000000002306'::uuid, null, '[{"kind":"contact","field":"religion","originalValue":null,"requestedValue":"Roman Catholic"}]'::jsonb, public.final_revisions_test_document('00000000-0000-4000-8000-000000002306'::uuid));
select extensions.throws_ok(
  $$select public.decide_profile_change_request('00000000-0000-4000-8000-000000002306'::uuid, 'approved', null)$$,
  '42501', 'You cannot review your own profile change request.', 'HR cannot approve their own request'
);

select * from extensions.finish();
rollback;
