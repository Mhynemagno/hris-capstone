begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(14);

select extensions.has_function('public', 'list_promotion_readiness', array['uuid'], 'HR live readiness RPC exists');
select extensions.has_function('public', 'get_my_promotion_readiness', 'Employee live readiness RPC exists');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001601', 'authenticated', 'authenticated', 'live-promo-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001602', 'authenticated', 'authenticated', 'live-promo-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000001603', 'authenticated', 'authenticated', 'live-promo-other@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000001601'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end where user_id in ('00000000-0000-4000-8000-000000001601'::uuid, '00000000-0000-4000-8000-000000001602'::uuid, '00000000-0000-4000-8000-000000001603'::uuid);

insert into public.ranks (id, name, code, sort_order, is_active) overriding system value
values (9911, 'Live Readiness Rank', 'LRR', 9911, true);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, rank_id, employment_started_on)
values
  ('00000000-0000-4000-8000-000000001611', '00000000-0000-4000-8000-000000001602', 'LIVE-001', 'Ready', 'Soon', 'live-promo-employee@example.test', 9911, '2020-01-01'),
  ('00000000-0000-4000-8000-000000001612', '00000000-0000-4000-8000-000000001603', 'LIVE-002', 'Never', 'Reviewed', 'live-promo-other@example.test', 9911, '2020-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001601';

select set_config('test.criterion_id', public.create_promotion_criterion(9911, 1, null, '[
  {"recordKind":"certification","requiredName":"Basic Course","label":"Basic Course","isMandatory":true},
  {"recordKind":"certification","requiredName":"Scuba Diving","label":"Scuba Diving","isMandatory":true}
]'::jsonb)::text, true);
select public.create_promotion_evaluation('00000000-0000-4000-8000-000000001611', 9911, current_setting('test.criterion_id')::uuid, current_date - 10, 'deferred', null, '[]'::jsonb);

select extensions.is(
  (select jsonb_array_length(readiness -> 'missingRequirements') from public.list_promotion_readiness('00000000-0000-4000-8000-000000001611')),
  2, 'Before any certification both requirements are missing'
);

-- HR adds a certification after the review was saved (the tester's scenario).
set local role postgres;
insert into public.certifications (employee_id, name, issuer, issued_on) values ('00000000-0000-4000-8000-000000001611', 'basic course ', 'PNP', current_date - 1);
set local role authenticated;

select extensions.is(
  (select readiness -> 'missingRequirements' from public.list_promotion_readiness('00000000-0000-4000-8000-000000001611')),
  '["Scuba Diving"]'::jsonb, 'A certification added after the review clears its requirement right away'
);
select extensions.is(
  (select readiness -> 'requirements' from public.list_promotion_readiness('00000000-0000-4000-8000-000000001611')),
  '[{"label": "Basic Course", "met": true}, {"label": "Scuba Diving", "met": false}]'::jsonb, 'Each requirement reports whether it is met'
);

-- A training with the same name also counts (the record form merges Certification / Training).
set local role postgres;
insert into public.training_records (employee_id, course_name, provider, completed_on) values ('00000000-0000-4000-8000-000000001611', 'Scuba Diving', 'PNP Maritime', current_date - 1);
set local role authenticated;

select extensions.ok(
  (select (readiness ->> 'isReady')::boolean from public.list_promotion_readiness('00000000-0000-4000-8000-000000001611')),
  'With every requirement met and enough service the employee is ready'
);

select public.create_promotion_evaluation('00000000-0000-4000-8000-000000001611', 9911, current_setting('test.criterion_id')::uuid, current_date, 'recommended', null, '[]'::jsonb);
select extensions.is(
  (select count(*)::integer from public.list_promotion_readiness() where employee_id = '00000000-0000-4000-8000-000000001611'),
  1, 'HR sees one row per employee, from the latest review'
);
select extensions.is(
  (select recommendation from public.list_promotion_readiness('00000000-0000-4000-8000-000000001611')),
  'recommended', 'The row carries the latest recommendation'
);
select extensions.is(
  (select employee_name from public.list_promotion_readiness('00000000-0000-4000-8000-000000001611')),
  'Soon, Ready', 'The row names the employee'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001602';
select extensions.throws_ok($$select * from public.list_promotion_readiness()$$, '42501', null, 'Employees cannot list everyone''s readiness');
select extensions.is(
  (select public.get_my_promotion_readiness() ->> 'targetRankName'),
  'Live Readiness Rank', 'The employee sees the target rank of their latest review'
);
select extensions.is(
  (select public.get_my_promotion_readiness() -> 'readiness' -> 'missingRequirements'),
  '[]'::jsonb, 'The employee sees live missing requirements'
);
select extensions.is(
  (select (public.get_my_promotion_readiness() -> 'readiness' ->> 'yearsOfService')::integer),
  extract(year from age(current_date, date '2020-01-01'))::integer, 'Years of service are counted as of today'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001603';
select extensions.ok(public.get_my_promotion_readiness() is null, 'An employee without a review gets nothing');

select * from extensions.finish();

rollback;
