begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(15);

-- Fixture: an administrator, an HR officer who decided a past leave request (the live failure:
-- clearing "decided by" re-tested "start date must be today or later"), and an employee account
-- with a personnel record, leave and a deployment.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000009701', 'authenticated', 'authenticated', 'purge-admin@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009702', 'authenticated', 'authenticated', 'purge-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009703', 'authenticated', 'authenticated', 'purge-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000009704', 'authenticated', 'authenticated', 'purge-other@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000009701'::uuid then 'system_administrator'::public.app_role
  when '00000000-0000-4000-8000-000000009702'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end
where user_id between '00000000-0000-4000-8000-000000009701'::uuid and '00000000-0000-4000-8000-000000009704'::uuid;

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, employment_started_on)
values
  ('00000000-0000-4000-8000-000000009711', '00000000-0000-4000-8000-000000009703', 'PURGE-1', 'Paula', 'Purge', 'paula.purge@example.test', '2024-01-01'),
  ('00000000-0000-4000-8000-000000009712', '00000000-0000-4000-8000-000000009704', 'PURGE-2', 'Otto', 'Other', 'otto.other@example.test', '2024-01-01');

insert into public.leave_types (id, name, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000009721', 'Purge test leave', '00000000-0000-4000-8000-000000009702', '00000000-0000-4000-8000-000000009702');

-- Past leave can only exist from before the rule; this rolled-back transaction backdates two.
set local session_replication_role = replica;
insert into public.leave_requests (id, employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on, status, decided_by_user_id, decided_at)
values
  ('00000000-0000-4000-8000-000000009731', '00000000-0000-4000-8000-000000009712', '00000000-0000-4000-8000-000000009704', '00000000-0000-4000-8000-000000009721', 'Purge test leave', '2026-09-27', '2026-09-28', 'approved', '00000000-0000-4000-8000-000000009702', now()),
  ('00000000-0000-4000-8000-000000009732', '00000000-0000-4000-8000-000000009711', '00000000-0000-4000-8000-000000009703', '00000000-0000-4000-8000-000000009721', 'Purge test leave', '2026-09-27', '2026-09-28', 'approved', '00000000-0000-4000-8000-000000009702', now());
set local session_replication_role = origin;

-- A promotion criterion from before the 1-3 years rule (the second live failure).
insert into public.ranks (name, code, sort_order) values ('Purge test rank', 'PTR', 9701);
set local session_replication_role = replica;
insert into public.promotion_criteria (id, target_rank_id, minimum_years_of_service, created_by_user_id, updated_by_user_id)
select '00000000-0000-4000-8000-000000009751', id, 5, '00000000-0000-4000-8000-000000009702', '00000000-0000-4000-8000-000000009702'
from public.ranks where code = 'PTR';
set local session_replication_role = origin;

insert into public.deployments (id, employee_id, location, assignment_role, starts_on, created_by_user_id, updated_by_user_id)
values ('00000000-0000-4000-8000-000000009741', '00000000-0000-4000-8000-000000009711', 'Checkpoint 3', 'Patrol', current_date, '00000000-0000-4000-8000-000000009702', '00000000-0000-4000-8000-000000009702');

-- The start-date rule now applies only when a start date is set or changed.
select extensions.lives_ok(
  $$update public.leave_requests set reason = 'Updated later.' where id = '00000000-0000-4000-8000-000000009731'$$,
  'A past leave request can still be updated');
select extensions.throws_ok(
  $$update public.leave_requests set starts_on = '2026-01-01' where id = '00000000-0000-4000-8000-000000009731'$$,
  '23514', null, 'A leave request cannot be moved to a past start date');
select extensions.throws_ok(
  $$insert into public.leave_requests (employee_id, submitted_by_user_id, leave_type_id, leave_type_name, starts_on, ends_on)
    values ('00000000-0000-4000-8000-000000009712', '00000000-0000-4000-8000-000000009704', '00000000-0000-4000-8000-000000009721', 'Purge test leave', '2026-01-01', '2026-01-02')$$,
  '23514', null, 'New leave cannot start in the past');

-- The preview no longer lists blockers for accounts.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009701';
select extensions.is(
  (public.get_deletion_impact('managed_user', '00000000-0000-4000-8000-000000009702') ->> 'canDelete')::boolean,
  true,
  'An HR account that decided leave can be deleted');
select extensions.ok(
  (public.get_deletion_impact('managed_user', '00000000-0000-4000-8000-000000009703') -> 'removes') @> '[{"label": "personnel record", "count": 1}, {"label": "leave requests", "count": 1}, {"label": "deployments", "count": 1}]',
  'The preview lists the personnel record, leave and deployments that will be removed');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009702';
select extensions.throws_ok(
  $$select public.remove_managed_account_data('00000000-0000-4000-8000-000000009703')$$,
  '42501', 'Administrator access is required.', 'HR cannot remove account data');

-- Delete the HR account the way the Edge Function does: remove data, then the auth user.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009701';
select extensions.lives_ok(
  $$select public.remove_managed_account_data('00000000-0000-4000-8000-000000009702')$$,
  'Removing the HR account''s data succeeds');
set local role postgres;
select extensions.lives_ok(
  $$delete from auth.users where id = '00000000-0000-4000-8000-000000009702'$$,
  'The HR account that decided a past leave request can be deleted');
select extensions.is(
  (select minimum_years_of_service::text || '/' || coalesce(created_by_user_id::text, 'cleared') from public.promotion_criteria where id = '00000000-0000-4000-8000-000000009751'),
  '5/cleared',
  'An older promotion criterion outside the 1-3 years rule is kept, with "created by" cleared');
select extensions.is(
  (select decided_by_user_id from public.leave_requests where id = '00000000-0000-4000-8000-000000009731'),
  null,
  'Another employee''s leave request is kept, with "decided by" cleared');

-- Delete the employee account: their personnel record and its records go too.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000009701';
select extensions.ok(
  public.remove_managed_account_data('00000000-0000-4000-8000-000000009703') ? 'storage',
  'Removing the employee account''s data returns the files to remove');
set local role postgres;
select extensions.lives_ok(
  $$delete from auth.users where id = '00000000-0000-4000-8000-000000009703'$$,
  'The employee account can be deleted');
select extensions.is(
  (select count(*) from public.employees where id = '00000000-0000-4000-8000-000000009711'),
  0::bigint,
  'The employee''s personnel record is removed');
select extensions.is(
  (select count(*) from public.leave_requests where employee_id = '00000000-0000-4000-8000-000000009711')
    + (select count(*) from public.deployments where employee_id = '00000000-0000-4000-8000-000000009711'),
  0::bigint,
  'The employee''s leave requests and deployments are removed');
select extensions.is(
  (select count(*) from public.employees where id = '00000000-0000-4000-8000-000000009712'),
  1::bigint,
  'Other personnel records are untouched');

select * from extensions.finish();
rollback;
