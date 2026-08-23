begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(33);

select extensions.has_table('public', 'profile_change_requests', 'Profile change request headers exist');
select extensions.has_table('public', 'profile_change_request_changes', 'Proposed changes exist');
select extensions.has_table('public', 'profile_change_request_documents', 'Request document metadata exists');
select extensions.has_table('public', 'profile_change_request_history', 'Request history exists');
select extensions.has_function('public', 'submit_profile_change_request', array['uuid', 'text', 'jsonb', 'jsonb'], 'Submission RPC exists');
select extensions.has_function('public', 'cancel_profile_change_request', array['uuid'], 'Cancellation RPC exists');
select extensions.has_function('public', 'decide_profile_change_request', array['uuid', 'text', 'text'], 'Decision RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'profile-admin@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'profile-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'profile-other@example.test', now(), now());

update public.user_roles
set role = case user_id
  when '00000000-0000-4000-8000-000000000101'::uuid then 'system_administrator'::public.app_role
  else 'employee'::public.app_role
end
where user_id in ('00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-4000-8000-000000000102'::uuid, '00000000-0000-4000-8000-000000000103'::uuid);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000102', 'PROF-001', 'Profile', 'Employee', 'profile-employee@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000103', 'PROF-002', 'Other', 'Employee', 'profile-other@example.test', '2024-01-01');
insert into public.qualifications (id, employee_id, name, institution, awarded_on)
values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', 'Diploma', 'Fixture University', '2020-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
select extensions.lives_ok(
  $$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000301'::uuid, 'Updated mobile number', '[{"kind":"contact","field":"phone","originalValue":null,"requestedValue":"+976 99112233"}]'::jsonb, '[]'::jsonb)$$,
  'Employee submits a pending contact change without writing official data'
);
select extensions.is((select phone from public.employees where id = '00000000-0000-4000-8000-000000000201'::uuid), null::text, 'Submission does not update the official employee record');
select extensions.throws_ok(
  $$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000301'::uuid, 'approved', null)$$,
  '42501', null, 'Employee cannot decide a request'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
select extensions.lives_ok($$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000301'::uuid, 'approved', null)$$, 'Administrator approves a pending request');
set local role postgres;
select extensions.is((select phone from public.employees where id = '00000000-0000-4000-8000-000000000201'::uuid), '+976 99112233', 'Approval updates official contact data');
select extensions.ok(exists (select 1 from public.notifications where recipient_user_id = '00000000-0000-4000-8000-000000000102'::uuid and type = 'profile_change_decision'), 'Approval creates an employee notification');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
select extensions.lives_ok($$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000302'::uuid, null, '[{"kind":"contact","field":"address","originalValue":null,"requestedValue":"Ulaanbaatar"}]'::jsonb, '[]'::jsonb)$$, 'Employee submits a request that can be rejected');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
select extensions.lives_ok($$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000302'::uuid, 'rejected', 'Please provide a current proof of address.')$$, 'Administrator rejects with a reason');
set local role postgres;
select extensions.is((select status from public.profile_change_requests where id = '00000000-0000-4000-8000-000000000302'::uuid), 'rejected', 'Rejected request is retained in history');
select extensions.is((select address from public.employees where id = '00000000-0000-4000-8000-000000000201'::uuid), null::text, 'Rejection leaves official data unchanged');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
select extensions.lives_ok($$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000303'::uuid, null, '[{"kind":"contact","field":"address","originalValue":null,"requestedValue":"Ulaanbaatar"}]'::jsonb, '[]'::jsonb)$$, 'Employee submits a request that can be cancelled');
select extensions.lives_ok($$select public.cancel_profile_change_request('00000000-0000-4000-8000-000000000303'::uuid)$$, 'Employee cancels their pending request');
set local role postgres;
select extensions.is((select status from public.profile_change_requests where id = '00000000-0000-4000-8000-000000000303'::uuid), 'cancelled', 'Cancelled request is retained in history');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
select extensions.lives_ok($$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000304'::uuid, null, '[{"kind":"qualification","operation":"add","originalValue":null,"requestedValue":{"name":"Bachelor of Science","institution":"Fixture University","qualificationLevel":"Bachelor","fieldOfStudy":"Computer Science","awardedOn":"2024-06-01","notes":null}}]'::jsonb, '[]'::jsonb)$$, 'Employee submits a qualification addition');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
select extensions.lives_ok($$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000304'::uuid, 'approved', null)$$, 'Administrator approves a qualification addition');
set local role postgres;
select extensions.ok(exists (select 1 from public.qualifications where employee_id = '00000000-0000-4000-8000-000000000201'::uuid and name = 'Bachelor of Science'), 'Approval creates the requested qualification');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
select extensions.lives_ok($$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000305'::uuid, null, '[{"kind":"qualification","operation":"edit","qualificationId":"00000000-0000-4000-8000-000000000401","originalValue":{"name":"Diploma","institution":"Fixture University","qualificationLevel":null,"fieldOfStudy":null,"awardedOn":"2020-01-01","notes":null},"requestedValue":{"name":"Advanced Diploma","institution":"Fixture University","qualificationLevel":null,"fieldOfStudy":null,"awardedOn":"2020-01-01","notes":null}}]'::jsonb, '[]'::jsonb)$$, 'Employee submits a qualification edit');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
select extensions.lives_ok($$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000305'::uuid, 'approved', null)$$, 'Administrator approves a qualification edit');
set local role postgres;
select extensions.is((select name from public.qualifications where id = '00000000-0000-4000-8000-000000000401'::uuid), 'Advanced Diploma', 'Approval updates the requested qualification');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
select extensions.lives_ok($$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000306'::uuid, null, '[{"kind":"qualification","operation":"remove","qualificationId":"00000000-0000-4000-8000-000000000401","originalValue":{"name":"Advanced Diploma","institution":"Fixture University","qualificationLevel":null,"fieldOfStudy":null,"awardedOn":"2020-01-01","notes":null},"requestedValue":null}]'::jsonb, '[]'::jsonb)$$, 'Employee submits a qualification removal');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
select extensions.lives_ok($$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000306'::uuid, 'approved', null)$$, 'Administrator approves a qualification removal');
set local role postgres;
select extensions.is((select count(*) from public.qualifications where id = '00000000-0000-4000-8000-000000000401'::uuid), 0::bigint, 'Approval removes the requested qualification');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
select extensions.lives_ok($$select public.submit_profile_change_request('00000000-0000-4000-8000-000000000307'::uuid, null, '[{"kind":"contact","field":"phone","originalValue":"+976 99112233","requestedValue":"+976 99112234"}]'::jsonb, '[]'::jsonb)$$, 'Employee submits a request with a stale-snapshot guard');
set local role postgres;
update public.employees set phone = '+976 88880000' where id = '00000000-0000-4000-8000-000000000201'::uuid;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
select extensions.throws_ok($$select public.decide_profile_change_request('00000000-0000-4000-8000-000000000307'::uuid, 'approved', null)$$, 'P0001', null, 'Approval refuses a stale contact snapshot');
set local role postgres;
select extensions.is((select status from public.profile_change_requests where id = '00000000-0000-4000-8000-000000000307'::uuid), 'pending', 'Failed stale approval leaves the request pending');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000103';
select extensions.is((select count(*) from public.profile_change_requests), 0::bigint, 'Other employees cannot read requests they did not submit');

select * from extensions.finish();
rollback;
