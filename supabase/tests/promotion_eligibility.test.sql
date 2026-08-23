begin;

set local role postgres;
set local search_path = extensions, public;

select extensions.plan(25);

select extensions.has_table('public', 'promotion_criteria', 'Promotion criteria table exists');
select extensions.has_table('public', 'promotion_criteria_requirements', 'Promotion requirement table exists');
select extensions.has_table('public', 'performance_ratings', 'Performance ratings table exists');
select extensions.has_table('public', 'promotion_evaluations', 'Promotion evaluations table exists');
select extensions.has_table('public', 'promotion_evaluation_evidence', 'Promotion evidence table exists');
select extensions.has_table('public', 'employee_promotion_eligibility_summaries', 'Employee-safe summary table exists');
select extensions.has_function('public', 'create_promotion_criterion', array['integer', 'integer', 'integer', 'jsonb'], 'Criterion creation RPC exists');
select extensions.has_function('public', 'create_performance_rating', array['uuid', 'integer', 'date', 'date', 'text'], 'Rating creation RPC exists');
select extensions.has_function('public', 'create_promotion_evaluation', array['uuid', 'integer', 'uuid', 'date', 'text', 'text', 'jsonb'], 'Evaluation creation RPC exists');
select extensions.has_function('public', 'update_promotion_criterion', array['uuid', 'timestamp with time zone', 'integer', 'integer', 'integer', 'boolean', 'jsonb'], 'Criterion update RPC exists');
select extensions.has_function('public', 'update_performance_rating', array['uuid', 'timestamp with time zone', 'integer', 'date', 'date', 'text'], 'Rating update RPC exists');
select extensions.has_function('public', 'update_promotion_evaluation', array['uuid', 'timestamp with time zone', 'date', 'text', 'text', 'jsonb'], 'Evaluation update RPC exists');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.promotion_criteria')), false), 'Criteria use RLS');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.performance_ratings')), false), 'Ratings use RLS');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.promotion_evaluations')), false), 'Evaluations use RLS');
select extensions.ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.employee_promotion_eligibility_summaries')), false), 'Employee summaries use RLS');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000801', 'authenticated', 'authenticated', 'promotion-hr@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000802', 'authenticated', 'authenticated', 'promotion-employee@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000803', 'authenticated', 'authenticated', 'promotion-other@example.test', now(), now());

update public.user_roles set role = case user_id
  when '00000000-0000-4000-8000-000000000801'::uuid then 'hr_personnel'::public.app_role
  else 'employee'::public.app_role
end where user_id in ('00000000-0000-4000-8000-000000000801'::uuid, '00000000-0000-4000-8000-000000000802'::uuid, '00000000-0000-4000-8000-000000000803'::uuid);

insert into public.positions (id, title, is_active) overriding system value
values (9901, 'Senior Officer', true);

insert into public.employees (id, profile_id, employee_number, first_name, last_name, personal_email, position_id, employment_started_on)
values
  ('00000000-0000-4000-8000-000000000811', '00000000-0000-4000-8000-000000000802', 'PRO-001', 'Promotion', 'Employee', 'promotion-employee@example.test', 9901, '2020-01-01'),
  ('00000000-0000-4000-8000-000000000812', '00000000-0000-4000-8000-000000000803', 'PRO-002', 'Other', 'Employee', 'promotion-other@example.test', 9901, '2020-01-01');

insert into public.certifications (id, employee_id, name, issuer, issued_on)
values ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', 'First Aid', 'Safety Office', '2024-01-01');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';

select set_config('test.criterion_id', public.create_promotion_criterion(9901, 3, 4, '[{"recordKind":"certification","requiredName":"First Aid","label":"First-aid certification","isMandatory":true}]'::jsonb)::text, true);
select extensions.lives_ok($$select public.create_performance_rating('00000000-0000-4000-8000-000000000811'::uuid, 5, '2025-01-01', '2025-12-31', 'Strong review')$$, 'HR records an overall rating');
select extensions.lives_ok($$select public.create_promotion_evaluation('00000000-0000-4000-8000-000000000811'::uuid, 9901, current_setting('test.criterion_id')::uuid, '2026-08-24', 'recommended', 'Ready for manual consideration', '[]'::jsonb)$$, 'HR creates an advisory evaluation');
select extensions.ok((select is_ready from public.promotion_evaluations where employee_id = '00000000-0000-4000-8000-000000000811'), 'Matching records and rating produce readiness');
select extensions.is((select position_id from public.employees where id = '00000000-0000-4000-8000-000000000811'::uuid), 9901::bigint, 'Evaluation never changes the employee position');

set local role postgres;
select extensions.ok(exists (select 1 from public.audit_logs where entity_type = 'promotion_evaluations' and action = 'created'), 'Evaluation is audited');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000802';
select extensions.is((select count(*) from public.employee_promotion_eligibility_summaries), 1::bigint, 'Employee reads only their safe summary');
select extensions.is_empty($$select * from public.promotion_evaluations$$, 'Employee cannot read HR-private evaluation rows');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000803';
select extensions.is((select count(*) from public.employee_promotion_eligibility_summaries), 0::bigint, 'Other employee cannot read another employee summary');
select extensions.throws_ok($$select public.create_promotion_criterion(9901, 3, 4, '[]'::jsonb)$$, '42501', null, 'Employee cannot create criteria');

select * from extensions.finish();

rollback;
